import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsSelect, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Feedback, FeedbackStatus } from './feedback.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ListFeedbackQueryDto } from './dto/list-feedback-query.dto';
import { PaginatedFeedbackResponse } from './dto/paginated-feedback.response';

// Nested `select` restricts the joined User columns — without it, TypeORM
// would serialize the full User relation (password hash included) into
// admin-facing feedback responses.
const SAFE_SELECT: FindOptionsSelect<Feedback> = {
  id: true,
  userId: true,
  message: true,
  status: true,
  handledByUserId: true,
  handledAt: true,
  createdAt: true,
  user: { id: true, name: true, email: true },
  handledByUser: { id: true, name: true },
};

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(Feedback)
    private feedbackRepository: Repository<Feedback>,
    private eventEmitter: EventEmitter2,
  ) {}

  // POST /api/feedback — any authenticated user.
  async create(userId: string, dto: CreateFeedbackDto): Promise<Feedback> {
    const feedback = this.feedbackRepository.create({
      userId,
      message: dto.message,
      status: FeedbackStatus.NEW,
    });
    const saved = await this.feedbackRepository.save(feedback);
    this.logger.log(`FEEDBACK_SUBMITTED: ${saved.id} by ${userId}`);

    // Two listeners: NotificationsService sends the submitter a thank-you
    // notification, RealtimeGateway pushes a live update to admins — see
    // §9's domain-event decoupling principle, same as form.response.created.
    this.eventEmitter.emit('feedback.created', {
      id: saved.id,
      userId: saved.userId,
      message: saved.message,
      createdAt: saved.createdAt,
    });

    return saved;
  }

  // GET /api/feedback — [Roles: ADMIN/SUPER_ADMIN], sortable by date,
  // optional status filter so admins can focus on NEW items.
  async findAll(
    query: ListFeedbackQueryDto,
  ): Promise<PaginatedFeedbackResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.feedbackRepository.findAndCount({
      where: query.status ? { status: query.status } : {},
      relations: ['user', 'handledByUser'],
      select: SAFE_SELECT,
      order: { createdAt: query.sort ?? 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  // GET /api/feedback/:id — [Roles: ADMIN/SUPER_ADMIN]. Full detail view.
  async findOne(id: string): Promise<Feedback> {
    const feedback = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user', 'handledByUser'],
      select: SAFE_SELECT,
    });
    if (!feedback) {
      throw new NotFoundException(`Feedback with ID ${id} not found`);
    }
    return feedback;
  }

  // PATCH /api/feedback/:id/status — [Roles: ADMIN/SUPER_ADMIN]. Moving away
  // from NEW stamps who picked it up, so a second admin sees it's in hand.
  async updateStatus(
    id: string,
    status: FeedbackStatus,
    adminUserId: string,
  ): Promise<Feedback> {
    const feedback = await this.feedbackRepository.findOne({ where: { id } });
    if (!feedback) {
      throw new NotFoundException(`Feedback with ID ${id} not found`);
    }

    feedback.status = status;
    if (status === FeedbackStatus.NEW) {
      feedback.handledByUserId = null;
      feedback.handledAt = null;
    } else {
      feedback.handledByUserId = adminUserId;
      feedback.handledAt = new Date();
    }

    await this.feedbackRepository.save(feedback);

    // Reload with the same safe relation shape as findAll() — the caller
    // (the admin list/detail UI) replaces its local copy with this
    // response, so it needs `user`/`handledByUser` populated, not just the
    // bare row.
    return this.findOne(id);
  }

  // DELETE /api/feedback/:id — [Roles: ADMIN/SUPER_ADMIN], once handled.
  async remove(id: string): Promise<void> {
    const result = await this.feedbackRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Feedback with ID ${id} not found`);
    }
  }
}
