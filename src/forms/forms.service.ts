import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Form, FormStatus } from './form.entity';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { ListFormsQueryDto } from './dto/list-forms-query.dto';
import { PaginatedFormsResponse } from './dto/paginated-forms.response';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(
    @InjectRepository(Form)
    private formsRepository: Repository<Form>,
    private usersService: UsersService,
  ) {}

  async findAllByOwner(
    ownerId: string,
    query: ListFormsQueryDto,
  ): Promise<PaginatedFormsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.formsRepository.findAndCount({
      where: {
        ownerId,
        ...(query.search ? { title: ILike(`%${query.search}%`) } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      order: { updatedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
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

    // An ACTIVE form must keep at least one field — emptying it via PATCH
    // pulls the form off the public link, same rule the editor applies
    // client-side (see form-editor.md, decision #7 and the auto-unpublish
    // note). The response carries the new status, so clients stay in sync.
    if (form.status === FormStatus.ACTIVE && form.fields.length === 0) {
      form.status = FormStatus.CLOSED;
      this.logger.log(
        `FORM_AUTO_CLOSED: Form ${id} lost its last field while ACTIVE`,
      );
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

    // Mirrors the editor's disabled Publish button — an empty form can't go
    // live (form-editor.md, decision #7). Enforced here too so the rule
    // holds for direct API calls, not just the UI.
    if (form.fields.length === 0) {
      throw new BadRequestException(
        'A form must have at least one field to be published',
      );
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

  // Admin browsing of another user's forms — Admin Panel "Forms" tab. Mirrors
  // the ADMIN/SUPER_ADMIN session-management restriction in
  // UsersService.assertAdminCanManageSessions: ADMIN can only act on regular
  // USER accounts, SUPER_ADMIN can act on anyone's.
  async findAllByOwnerAdmin(
    requestingUserId: string,
    targetUserId: string,
    query: ListFormsQueryDto,
  ): Promise<PaginatedFormsResponse> {
    await this.assertAdminCanManageForms(requestingUserId, targetUserId);
    return this.findAllByOwner(targetUserId, query);
  }

  async publishAdmin(id: string, requestingUserId: string): Promise<Form> {
    const form = await this.findFormById(id);
    await this.assertAdminCanManageForms(requestingUserId, form.ownerId);

    if (form.status === FormStatus.ACTIVE) {
      throw new BadRequestException('Form is already published');
    }
    if (form.fields.length === 0) {
      throw new BadRequestException(
        'A form must have at least one field to be published',
      );
    }

    form.status = FormStatus.ACTIVE;
    if (!form.publishedAt) {
      form.publishedAt = new Date();
    }

    const published = await this.formsRepository.save(form);
    this.logger.log(
      `FORM_PUBLISHED_BY_ADMIN: Form ${id} published by admin ${requestingUserId}`,
    );
    return published;
  }

  async unpublishAdmin(id: string, requestingUserId: string): Promise<Form> {
    const form = await this.findFormById(id);
    await this.assertAdminCanManageForms(requestingUserId, form.ownerId);

    if (form.status !== FormStatus.ACTIVE) {
      throw new BadRequestException('Only a published form can be unpublished');
    }

    form.status = FormStatus.CLOSED;
    const unpublished = await this.formsRepository.save(form);
    this.logger.log(
      `FORM_UNPUBLISHED_BY_ADMIN: Form ${id} unpublished by admin ${requestingUserId}`,
    );
    return unpublished;
  }

  async removeAdmin(id: string, requestingUserId: string): Promise<void> {
    const form = await this.findFormById(id);
    await this.assertAdminCanManageForms(requestingUserId, form.ownerId);

    await this.formsRepository.delete(id);
    this.logger.log(
      `FORM_DELETED_BY_ADMIN: Form ${id} deleted by admin ${requestingUserId}`,
    );
  }

  private async findFormById(id: string): Promise<Form> {
    const form = await this.formsRepository.findOne({ where: { id } });
    if (!form) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }
    return form;
  }

  private async assertAdminCanManageForms(
    requestingUserId: string,
    targetUserId: string,
  ): Promise<void> {
    const requestingUser = await this.usersService.findById(requestingUserId);
    if (!requestingUser) {
      throw new NotFoundException(
        `Requesting user with ID ${requestingUserId} not found`,
      );
    }

    const targetUser = await this.usersService.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    const reqRole = (requestingUser as any).role;
    const targetRole = (targetUser as any).role;

    if (reqRole === UserRole.ADMIN && targetRole !== UserRole.USER) {
      this.logger.warn(
        `FORM_MANAGE_DENIED: Admin ${requestingUserId} tried to manage forms of ${targetRole} user ${targetUserId}`,
      );
      throw new ForbiddenException('Admins can only manage forms of regular users');
    }
  }
}
