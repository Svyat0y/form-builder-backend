import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  FormFieldDto,
  FormSettingsDto,
  MAX_FIELDS_PER_FORM,
} from '../form-field.types';

export class UpdateFormDto {
  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Title cannot be empty' })
  @MaxLength(120, { message: 'Title must be at most 120 characters' })
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, type: [FormFieldDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  @ArrayMaxSize(MAX_FIELDS_PER_FORM, {
    message: `A form can have at most ${MAX_FIELDS_PER_FORM} fields`,
  })
  fields?: FormFieldDto[];

  @ApiProperty({ required: false, type: FormSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FormSettingsDto)
  settings?: FormSettingsDto;
}
