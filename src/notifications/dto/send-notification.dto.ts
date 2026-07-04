import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class SendNotificationDto {
  @ApiProperty({ description: 'Recipient user id' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'Heads up', maxLength: 120 })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(120)
  title: string;

  @ApiProperty({ example: 'Your account was reviewed.', maxLength: 2000 })
  @IsString()
  @IsNotEmpty({ message: 'Body is required' })
  @MaxLength(2000)
  body: string;

  @ApiPropertyOptional({ example: 'Send feedback', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  actionLabel?: string;

  // Relative in-app path (e.g. /feedback) or absolute URL — rendered as a
  // plain button, never interpolated into HTML, so no sanitization is needed.
  @ApiPropertyOptional({ example: '/feedback', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  actionUrl?: string;
}
