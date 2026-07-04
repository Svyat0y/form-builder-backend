import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Feedback, FeedbackStatus } from './feedback.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { ListFeedbackQueryDto } from './dto/list-feedback-query.dto';
import { PaginatedFeedbackResponse } from './dto/paginated-feedback.response';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(Feedback)
    private feedbackRepository: Repository<Feedback>,
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
    return saved;
  }

  // GET /api/feedback — [Roles: ADMIN/SUPER_ADMIN], sortable by date,
  // optional status filter so admins can focus on NEW items.
  async findAll(query: ListFeedbackQueryDto): Promise<PaginatedFeedbackResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.feedbackRepository.findAndCount({
      where: query.status ? { status: query.status } : {},
      relations: ['user', 'handledByUser'],
      // Nested `select` restricts the joined User columns — without it,
      // TypeORM would serialize the full User relation (password hash
      // included) into the admin-facing feedback list.
      select: {
        id: true,
        userId: true,
        message: true,
        status: true,
        handledByUserId: true,
        handledAt: true,
        createdAt: true,
        user: { id: true, name: true, email: true },
        handledByUser: { id: true, name: true },
      },
      order: { createdAt: query.sort ?? 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
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
    // (the admin list UI) replaces the row in place with this response, so
    // it needs `user`/`handledByUser` populated, not just the bare row.
    const updated = await this.feedbackRepository.findOne({
      where: { id },
      relations: ['user', 'handledByUser'],
      select: {
        id: true,
        userId: true,
        message: true,
        status: true,
        handledByUserId: true,
        handledAt: true,
        createdAt: true,
        user: { id: true, name: true, email: true },
        handledByUser: { id: true, name: true },
      },
    });
    return updated!;
  }

  // DELETE /api/feedback/:id — [Roles: ADMIN/SUPER_ADMIN], once handled.
  async remove(id: string): Promise<void> {
    const result = await this.feedbackRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Feedback with ID ${id} not found`);
    }
  }
}
