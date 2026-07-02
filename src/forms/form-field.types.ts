import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const FIELD_TYPES = [
  'text',
  'textarea',
  'radio',
  'checkbox',
  'select',
  'rating',
  'scale',
  'date',
  'file',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

// Choice-type fields support opt-in stats aggregation (trackStats) — see
// forms-realtime-architecture.md §5.1.
export const CHOICE_FIELD_TYPES: FieldType[] = [
  'radio',
  'checkbox',
  'select',
  'rating',
  'scale',
];

export const MAX_FIELDS_PER_FORM = 50;

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  minDate?: string;
  maxDate?: string;
  trackStats?: boolean;
}

// class-validator schema for the `fields` jsonb column, used on PATCH so
// malformed structures never reach the database — see §3 of the arch doc.
export class FormFieldDto implements FormField {
  @IsUUID('4')
  id: string;

  @IsIn(FIELD_TYPES)
  type: FieldType;

  @IsString()
  @MaxLength(200)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  placeholder?: string;

  @IsBoolean()
  required: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsNumber()
  min?: number;

  @IsOptional()
  @IsNumber()
  max?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  minLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  maxLabel?: string;

  @IsOptional()
  @IsISO8601()
  minDate?: string;

  @IsOptional()
  @IsISO8601()
  maxDate?: string;

  @IsOptional()
  @IsBoolean()
  trackStats?: boolean;
}

export interface FormSettings {
  successMessage?: string;
  allowMultipleResponses?: boolean;
}

export class FormSettingsDto implements FormSettings {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  successMessage?: string;

  @IsOptional()
  @IsBoolean()
  allowMultipleResponses?: boolean;
}
