import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum NotificationType {
  FORM_RESPONSE = 'FORM_RESPONSE',
  ADMIN_MESSAGE = 'ADMIN_MESSAGE',
  SYSTEM = 'SYSTEM',
}

// Context for clickability in the UI (e.g. jump to the form's responses
// page). See §3 of forms-realtime-architecture.md.
// actionLabel/actionUrl render as a single button under the message body —
// a deliberate alternative to inline markdown links, so the frontend never
// has to parse/sanitize admin-authored text as markup (see Phase 8 addendum).
export interface NotificationData {
  formId?: string;
  responseId?: string;
  fromUserId?: string;
  actionLabel?: string;
  actionUrl?: string;
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'jsonb', default: {} })
  data: NotificationData;

  // null = unread. See §8 — history persists across offline periods.
  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  @Index()
  createdAt: Date;
}
