import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { UsersModule } from '../users/users.module';

@Module({
  // UsersModule is imported for RolesGuard's UsersService dependency (see
  // src/common/guards/roles.guard.ts), same as other admin-gated modules.
  // User entity is registered directly (read-only id lookup for broadcast),
  // not routed through UsersService to avoid coupling to its business logic.
  imports: [
    TypeOrmModule.forFeature([Notification, User]),
    UsersModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
