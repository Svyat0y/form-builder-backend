import type { FieldType } from '../forms/form-field.types';

// GET /:id/responses/stats shape — see §5 of forms-realtime-architecture.md.
export interface FieldStats {
  fieldId: string;
  type: FieldType;
  distribution?: Record<string, number>;
  average?: number;
  latest?: string[];
}

export interface ResponseStats {
  total: number;
  today: number;
  completionRate: number;
  fields: FieldStats[];
}
