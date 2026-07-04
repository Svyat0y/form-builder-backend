import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import type { FormResponseAnswers } from '../response.entity';

export class SubmitResponseDto {
  @ApiProperty({
    description:
      'Answers keyed by FormField.id (may be empty if the form has no required fields)',
    example: { '7b6c3f60-1111-4222-8333-444455556666': 'Jane Doe' },
  })
  @IsObject()
  answers: FormResponseAnswers;
}
