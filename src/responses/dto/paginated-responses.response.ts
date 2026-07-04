import { ApiProperty } from '@nestjs/swagger';
import { FormResponse } from '../response.entity';

export class PaginatedResponsesResponse {
  @ApiProperty({ type: [FormResponse] })
  items: FormResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
