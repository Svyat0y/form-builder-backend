import { ApiProperty } from '@nestjs/swagger';
import { Form } from '../form.entity';

// Shape kept generic on purpose (items/total/page/limit) so any client-side
// data-fetching approach — a Redux thunk today, useSWRInfinite tomorrow —
// can page through it without a backend change.
export class PaginatedFormsResponse {
  @ApiProperty({ type: [Form] })
  items: Form[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
