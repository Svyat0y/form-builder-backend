import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback } from './feedback.entity';
import { FeedbackService } from './feedback.service';
import { FeedbackController } from './feedback.controller';
import { UsersModule } from '../users/users.module';

@Module({
  // UsersModule is imported for RolesGuard's UsersService dependency (see
  // src/common/guards/roles.guard.ts), same as other admin-gated modules.
  imports: [TypeOrmModule.forFeature([Feedback]), UsersModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
