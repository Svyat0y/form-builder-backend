import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import type { FormField, FormSettings } from './form-field.types';

export enum FormStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

@Entity('forms')
export class Form {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'enum', enum: FormStatus, default: FormStatus.DRAFT })
  status: FormStatus;

  @Column({ type: 'jsonb', default: [] })
  fields: FormField[];

  @Column({ type: 'jsonb', default: {} })
  settings: FormSettings;

  @Column({ type: 'int', default: 0 })
  responsesCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  // timestamptz, not the TypeORM default `timestamp` — a bare `timestamp`
  // column is timezone-naive, and node-postgres reads it back assuming the
  // process's local TZ, which skews every value by the server's UTC offset
  // (verified: DB stores correct UTC, but the API response comes back
  // shifted). timestamptz round-trips correctly regardless of server TZ.
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
