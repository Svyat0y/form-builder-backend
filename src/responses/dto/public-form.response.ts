import { ApiProperty } from '@nestjs/swagger';
import type { FormField } from '../../forms/form-field.types';

// GET /:id/public shape — only what a submitter needs to see. No ownerId,
// no responsesCount, no other internal fields. See §5 of
// forms-realtime-architecture.md.
export class PublicFormResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  fields: FormField[];

  @ApiProperty({ required: false })
  successMessage?: string;

  @ApiProperty()
  allowMultipleResponses: boolean;
}
