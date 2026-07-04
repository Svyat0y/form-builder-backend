import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { User } from '../users/user.entity';
import { Notification, NotificationType } from './notification.entity';
import { SendNotificationDto } from './dto/send-notification.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { PaginatedNotificationsResponse } from './dto/paginated-notifications.response';

const FEEDBACK_ACTION = {
  actionLabel: 'Send feedback',
  actionUrl: '/feedback',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationsRepository: Repository<Notification>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private eventEmitter: EventEmitter2,
  ) {}

  // GET /api/notifications — current user's feed, newest first.
  async findAllForUser(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.notificationsRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.notificationsRepository.count({
      where: { userId, readAt: IsNull() },
    });

    return { items, total, page, limit, unreadCount };
  }

  async markRead(id: string, userId: string): Promise<void> {
    const notification = await this.notificationsRepository.findOne({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    if (!notification.readAt) {
      await this.notificationsRepository.update(id, { readAt: new Date() });
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationsRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('readAt IS NULL')
      .execute();
  }

  // DELETE /api/notifications/:id — self-service, own notifications only.
  async remove(id: string, userId: string): Promise<void> {
    const result = await this.notificationsRepository.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
  }

  // DELETE /api/notifications — clears the current user's entire feed.
  async removeAll(userId: string): Promise<void> {
    await this.notificationsRepository.delete({ userId });
  }

  // POST /api/notifications/send — [Roles: ADMIN/SUPER_ADMIN]. See §5/§8.
  async sendAdminMessage(
    dto: SendNotificationDto,
    fromUserId: string,
  ): Promise<Notification> {
    const notification = await this.create({
      userId: dto.userId,
      type: NotificationType.ADMIN_MESSAGE,
      title: dto.title,
      body: dto.body,
      data: {
        fromUserId,
        actionLabel: dto.actionLabel,
        actionUrl: dto.actionUrl,
      },
    });

    this.logger.log(`ADMIN_MESSAGE_SENT: to ${dto.userId} from ${fromUserId}`);

    return notification;
  }

  // POST /api/notifications/broadcast — [Roles: ADMIN/SUPER_ADMIN]. One row
  // per user (bulk insert), one WS push to every connected socket — see
  // RealtimeGateway's notification.broadcast handler for the rationale on
  // why this is a deliberate exception to the per-user-room rule.
  async broadcastAdminMessage(
    dto: BroadcastNotificationDto,
    fromUserId: string,
  ): Promise<{ recipientCount: number }> {
    const users = await this.usersRepository.find({ select: ['id'] });

    const notifications = users.map((user) =>
      this.notificationsRepository.create({
        userId: user.id,
        type: NotificationType.ADMIN_MESSAGE,
        title: dto.title,
        body: dto.body,
        data: {
          fromUserId,
          actionLabel: dto.actionLabel,
          actionUrl: dto.actionUrl,
        },
        readAt: null,
      }),
    );

    await this.notificationsRepository.insert(notifications);

    this.eventEmitter.emit('notification.broadcast', {
      type: NotificationType.ADMIN_MESSAGE,
      title: dto.title,
      body: dto.body,
      data: {
        fromUserId,
        actionLabel: dto.actionLabel,
        actionUrl: dto.actionUrl,
      },
      createdAt: new Date(),
    });

    this.logger.log(
      `ADMIN_BROADCAST_SENT: to ${users.length} users from ${fromUserId}`,
    );

    return { recipientCount: users.length };
  }

  // On every form response, the owner gets a persisted notification + WS
  // push. Listening here (rather than ResponsesService calling us directly)
  // keeps the domain-event decoupling described in §2/§9 of the design doc.
  @OnEvent('form.response.created')
  async handleFormResponseCreated(payload: {
    formId: string;
    formTitle: string;
    ownerId: string;
    responsesCount: number;
    responseId: string;
    createdAt: Date;
  }): Promise<void> {
    await this.create({
      userId: payload.ownerId,
      type: NotificationType.FORM_RESPONSE,
      // Title carries the form's name (not a generic label) — the frontend
      // groups these by formId and shows this as the group heading.
      title: `New response on "${payload.formTitle}"`,
      body: null,
      data: { formId: payload.formId, responseId: payload.responseId },
    });
  }

  // AuthService emits this right after a new account is created — see §8
  // addendum. Kept as a listener (not a direct call) for the same reason as
  // handleFormResponseCreated: AuthModule never needs to know Notifications
  // exists.
  @OnEvent('user.registered')
  async handleUserRegistered(payload: { userId: string }): Promise<void> {
    await this.create({
      userId: payload.userId,
      type: NotificationType.SYSTEM,
      title: 'Welcome to Form builder',
      body: "Glad you're here. If something's unclear or you spot a bug, we'd like to hear about it.",
      data: { ...FEEDBACK_ACTION },
    });
  }

  // FeedbackService emits this on submit — same decoupling as the two
  // listeners above. RealtimeGateway separately listens on the same event
  // to push a live update to admins.
  @OnEvent('feedback.created')
  async handleFeedbackCreated(payload: { userId: string }): Promise<void> {
    await this.create({
      userId: payload.userId,
      type: NotificationType.SYSTEM,
      title: 'Thanks for your feedback',
      body: "We've received your message and will take a look. If it needs a reply, we'll follow up by email.",
      data: {},
    });
  }

  private async create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string | null;
    data: Notification['data'];
  }): Promise<Notification> {
    const notification = this.notificationsRepository.create({
      ...input,
      readAt: null,
    });
    const saved = await this.notificationsRepository.save(notification);

    // WS is an acceleration, not the source of truth — same principle as
    // response:new (see §7). A missed push is caught by the next GET fetch.
    this.eventEmitter.emit('notification.created', {
      id: saved.id,
      userId: saved.userId,
      type: saved.type,
      title: saved.title,
      body: saved.body,
      data: saved.data,
      createdAt: saved.createdAt,
    });

    return saved;
  }
}
