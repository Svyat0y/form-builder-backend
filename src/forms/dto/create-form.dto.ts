import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateFormDto {
  @ApiProperty({
    example: 'Customer feedback survey',
    description: 'Form title',
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(120, { message: 'Title must be at most 120 characters' })
  title: string;
}
