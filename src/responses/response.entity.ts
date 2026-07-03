import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Form } from '../forms/form.entity';

// Values keyed by FormField.id — see §3 of forms-realtime-architecture.md.
export type FormResponseAnswers = Record<string, string | string[] | number>;

@Entity('form_responses')
export class FormResponse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  formId: string;

  @ManyToOne(() => Form, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formId' })
  form: Form;

  @Column({ type: 'jsonb', default: {} })
  answers: FormResponseAnswers;

  // SHA-256(UA + IP subnet) — analytics/anti-spam signal only, never used to
  // block submissions. See decision #8 in forms-realtime-architecture.md.
  @Column({ type: 'varchar', nullable: true })
  submitterFingerprint: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  @Index()
  createdAt: Date;
}
