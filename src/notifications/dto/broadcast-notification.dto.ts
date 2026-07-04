import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class BroadcastNotificationDto {
  @ApiProperty({ example: 'Scheduled maintenance', maxLength: 120 })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(120)
  title: string;

  @ApiProperty({
    example: 'We will be down briefly this Sunday.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Body is required' })
  @MaxLength(2000)
  body: string;

  @ApiPropertyOptional({ example: 'Send feedback', maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  actionLabel?: string;

  @ApiPropertyOptional({ example: '/feedback', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  actionUrl?: string;
}
