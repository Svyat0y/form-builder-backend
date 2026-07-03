import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Form, FormStatus } from '../forms/form.entity';
import { FormsService } from '../forms/forms.service';
import type { FormField } from '../forms/form-field.types';
import { CHOICE_FIELD_TYPES } from '../forms/form-field.types';
import { generateDeviceFingerprint } from '../tokens/device-fingerprint.util';
import { FormResponse, FormResponseAnswers } from './response.entity';
import { SubmitResponseDto } from './dto/submit-response.dto';
import { ListResponsesQueryDto } from './dto/list-responses-query.dto';
import { PaginatedResponsesResponse } from './dto/paginated-responses.response';
import { PublicFormResponse } from './dto/public-form.response';
import { FieldStats, ResponseStats } from './stats.types';

const TEXT_VALUE_MAX_LENGTH: Record<string, number> = {
  text: 500,
  textarea: 5000,
};

@Injectable()
export class ResponsesService {
  private readonly logger = new Logger(ResponsesService.name);

  constructor(
    @InjectRepository(Form)
    private formsRepository: Repository<Form>,
    @InjectRepository(FormResponse)
    private responsesRepository: Repository<FormResponse>,
    private formsService: FormsService,
    private dataSource: DataSource,
  ) {}

  // GET /:id/public — only ACTIVE forms are visible; DRAFT/CLOSED look like
  // 404 to avoid leaking form existence/status. See §5 & §10.
  async getPublicForm(id: string): Promise<PublicFormResponse> {
    const form = await this.formsRepository.findOne({
      where: { id, status: FormStatus.ACTIVE },
    });

    if (!form) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }

    return {
      id: form.id,
      title: form.title,
      description: form.description,
      fields: form.fields,
      successMessage: form.settings?.successMessage,
      allowMultipleResponses: form.settings?.allowMultipleResponses ?? false,
    };
  }

  // POST /:id/submit — validates answers against the form's *current*
  // fields, then persists the response and bumps responsesCount in one
  // transaction. See §6 of forms-realtime-architecture.md.
  async submit(
    id: string,
    dto: SubmitResponseDto,
    meta: { userAgent: string; ipAddress?: string },
  ): Promise<{ id: string; createdAt: Date }> {
    const form = await this.formsRepository.findOne({
      where: { id, status: FormStatus.ACTIVE },
    });

    if (!form) {
      throw new NotFoundException(`Form with ID ${id} not found`);
    }

    const answers = this.validateAndSanitizeAnswers(form.fields, dto.answers);
    const submitterFingerprint = generateDeviceFingerprint(
      meta.userAgent,
      meta.ipAddress,
    );

    return this.dataSource.transaction(async (manager) => {
      const response = manager.create(FormResponse, {
        formId: form.id,
        answers,
        submitterFingerprint,
      });
      const saved = await manager.save(response);

      await manager.increment(Form, { id: form.id }, 'responsesCount', 1);

      this.logger.log(`RESPONSE_SUBMITTED: Form ${form.id}`);

      return { id: saved.id, createdAt: saved.createdAt };
    });
  }

  private validateAndSanitizeAnswers(
    fields: FormField[],
    rawAnswers: FormResponseAnswers,
  ): FormResponseAnswers {
    const fieldsById = new Map(fields.map((field) => [field.id, field]));
    const errors: string[] = [];
    const sanitized: FormResponseAnswers = {};

    for (const field of fields) {
      const value = rawAnswers[field.id];
      const isEmpty =
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0);

      if (field.required && isEmpty) {
        errors.push(`Field "${field.label}" is required`);
        continue;
      }

      if (isEmpty) continue;

      const validated = this.validateFieldValue(field, value, errors);
      if (validated !== undefined) {
        sanitized[field.id] = validated;
      }
    }

    // Keys not belonging to any current field are dropped instead of
    // rejected — a field may have been removed from the form after some
    // responses came in.
    for (const key of Object.keys(rawAnswers)) {
      if (!fieldsById.has(key)) {
        this.logger.warn(`RESPONSE_UNKNOWN_FIELD: dropped key ${key}`);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Invalid answers',
        errors,
      });
    }

    return sanitized;
  }

  private validateFieldValue(
    field: FormField,
    value: string | string[] | number,
    errors: string[],
  ): string | string[] | number | undefined {
    switch (field.type) {
      case 'text':
      case 'textarea': {
        if (typeof value !== 'string') {
          errors.push(`Field "${field.label}" must be text`);
          return undefined;
        }
        const maxLength = TEXT_VALUE_MAX_LENGTH[field.type];
        if (value.length > maxLength) {
          errors.push(
            `Field "${field.label}" must be at most ${maxLength} characters`,
          );
          return undefined;
        }
        return value;
      }

      case 'radio':
      case 'select': {
        if (typeof value !== 'string' || !field.options?.includes(value)) {
          errors.push(`Field "${field.label}" has an invalid value`);
          return undefined;
        }
        return value;
      }

      case 'checkbox': {
        if (
          !Array.isArray(value) ||
          !value.every((v) => field.options?.includes(v))
        ) {
          errors.push(`Field "${field.label}" has an invalid value`);
          return undefined;
        }
        return value;
      }

      case 'rating':
      case 'scale': {
        const min = field.min ?? (field.type === 'rating' ? 1 : 1);
        const max = field.max ?? (field.type === 'rating' ? 5 : 10);
        const num = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(num) || num < min || num > max) {
          errors.push(
            `Field "${field.label}" must be between ${min} and ${max}`,
          );
          return undefined;
        }
        return num;
      }

      case 'date': {
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
          errors.push(`Field "${field.label}" must be a valid date`);
          return undefined;
        }
        const time = Date.parse(value);
        if (field.minDate && time < Date.parse(field.minDate)) {
          errors.push(`Field "${field.label}" is before the allowed date`);
          return undefined;
        }
        if (field.maxDate && time > Date.parse(field.maxDate)) {
          errors.push(`Field "${field.label}" is after the allowed date`);
          return undefined;
        }
        return value;
      }

      default:
        errors.push(`Field "${field.label}" has an unsupported type`);
        return undefined;
    }
  }

  // GET /:id/responses — owner only, paginated, newest first.
  async findAllByForm(
    formId: string,
    ownerId: string,
    query: ListResponsesQueryDto,
  ): Promise<PaginatedResponsesResponse> {
    await this.formsService.findOwnedForm(formId, ownerId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.responsesRepository.findAndCount({
      where: { formId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  // GET /:id/responses/stats — owner only. See §5 for the response shape
  // and §5.1 for the trackStats opt-in.
  async getStats(formId: string, ownerId: string): Promise<ResponseStats> {
    const form = await this.formsService.findOwnedForm(formId, ownerId);
    const responses = await this.responsesRepository.find({
      where: { formId },
      order: { createdAt: 'DESC' },
    });

    const total = responses.length;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = responses.filter((r) => r.createdAt >= startOfToday).length;

    const requiredFieldIds = form.fields
      .filter((f) => f.required)
      .map((f) => f.id);
    const completionRate =
      total === 0 || requiredFieldIds.length === 0
        ? 1
        : responses.filter((r) =>
            requiredFieldIds.every(
              (fieldId) =>
                r.answers[fieldId] !== undefined && r.answers[fieldId] !== '',
            ),
          ).length / total;

    // text/textarea always surface as `latest`; choice-types only when the
    // owner opted in via trackStats; date/file are not shown in stats.
    const fields: FieldStats[] = form.fields
      .filter(
        (field) =>
          field.type === 'text' ||
          field.type === 'textarea' ||
          (field.trackStats && CHOICE_FIELD_TYPES.includes(field.type)),
      )
      .map((field) => this.buildFieldStats(field, responses));

    return { total, today, completionRate, fields };
  }

  private buildFieldStats(
    field: FormField,
    responses: FormResponse[],
  ): FieldStats {
    const base = { fieldId: field.id, type: field.type };

    if (field.type === 'text' || field.type === 'textarea') {
      const latest = responses
        .map((r) => r.answers[field.id])
        .filter((v): v is string => typeof v === 'string' && v !== '')
        .slice(0, 10);
      return { ...base, latest };
    }

    const distribution: Record<string, number> = {};
    let sum = 0;
    let count = 0;

    for (const response of responses) {
      const value = response.answers[field.id];
      if (value === undefined) continue;

      const values = Array.isArray(value) ? value : [value];
      for (const v of values) {
        const key = String(v);
        distribution[key] = (distribution[key] ?? 0) + 1;
      }

      if (field.type === 'rating' || field.type === 'scale') {
        const num = Number(value);
        if (!Number.isNaN(num)) {
          sum += num;
          count += 1;
        }
      }
    }

    const average =
      field.type === 'rating' || field.type === 'scale'
        ? count > 0
          ? sum / count
          : 0
        : undefined;

    return { ...base, distribution, average };
  }
}
