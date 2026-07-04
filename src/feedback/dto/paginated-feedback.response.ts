import { ApiProperty } from '@nestjs/swagger';
import { Feedback } from '../feedback.entity';

export class PaginatedFeedbackResponse {
  @ApiProperty({ type: [Feedback] })
  items: Feedback[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
