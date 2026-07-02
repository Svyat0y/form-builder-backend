import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Form, FormStatus } from './form.entity';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    @InjectRepository(Form)
    private formsRepository: Repository<Form>,
  ) {}

  async findAllByOwner(ownerId: string): Promise<Form[]> {
    return this.formsRepository.find({
      where: { ownerId },
      order: { updatedAt: 'DESC' },
    });
  }

  async create(ownerId: string, dto: CreateFormDto): Promise<Form> {
    const form = this.formsRepository.create({
      ownerId,
      title: dto.title,
      status: FormStatus.DRAFT,
      fields: [],
    });

    return this.formsRepository.save(form);
  }

  // Fetches a form and asserts the requesting user owns it. Every
  // owner-scoped operation (get/update/delete/publish/unpublish) goes
  // through here — see §5 of forms-realtime-architecture.md.
  async findOwnedForm(id: string, ownerId: string): Promise<Form> {
    const form = await this.formsRepository.findOne({ where: { id } });

    if (!form) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }

    if (form.ownerId !== ownerId) {
      this.logger.warn(
        `FORM_ACCESS_DENIED: User ${ownerId} tried to access form ${id} owned by ${form.ownerId}`,
      );
      throw new ForbiddenException('You do not own this form');
    }

    return form;
  }

  async update(id: string, ownerId: string, dto: UpdateFormDto): Promise<Form> {
    const form = await this.findOwnedForm(id, ownerId);

    if (dto.title !== undefined) form.title = dto.title;
    if (dto.description !== undefined) form.description = dto.description;
    if (dto.fields !== undefined) form.fields = dto.fields;
    if (dto.settings !== undefined) {
      form.settings = { ...form.settings, ...dto.settings };
    }

    return this.formsRepository.save(form);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    await this.findOwnedForm(id, ownerId);
    await this.formsRepository.delete(id);
  }

  // DRAFT|CLOSED -> ACTIVE — see §4 of forms-realtime-architecture.md.
  async publish(id: string, ownerId: string): Promise<Form> {
    const form = await this.findOwnedForm(id, ownerId);

    if (form.status === FormStatus.ACTIVE) {
      throw new BadRequestException('Form is already published');
    }

    form.status = FormStatus.ACTIVE;
    if (!form.publishedAt) {
      form.publishedAt = new Date();
    }

    const published = await this.formsRepository.save(form);
    this.logger.log(`FORM_PUBLISHED: Form ${id} published by ${ownerId}`);
    return published;
  }

  // ACTIVE -> CLOSED — see §4 of forms-realtime-architecture.md.
  async unpublish(id: string, ownerId: string): Promise<Form> {
    const form = await this.findOwnedForm(id, ownerId);

    if (form.status !== FormStatus.ACTIVE) {
      throw new BadRequestException('Only a published form can be unpublished');
    }

    form.status = FormStatus.CLOSED;

    const unpublished = await this.formsRepository.save(form);
    this.logger.log(`FORM_UNPUBLISHED: Form ${id} unpublished by ${ownerId}`);
    return unpublished;
  }
}
