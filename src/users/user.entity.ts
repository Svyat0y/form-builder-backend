import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  password?: string;

  @Column({ nullable: true })
  googleId?: string;

  @Column({ nullable: true })
  facebookId?: string;

  @Column({ type: 'varchar', nullable: true })
  avatar: string | null;

  // timestamptz, not the TypeORM default `timestamp` — a bare `timestamp`
  // column is timezone-naive, and node-postgres reads it back assuming the
  // process's local TZ, which skews every value by the server's UTC offset.
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ type: 'varchar', nullable: true })
  resetPasswordToken: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resetPasswordExpiry: Date | null;

  @Column({ type: 'boolean', default: true })
  emailOnResponse: boolean;
}
