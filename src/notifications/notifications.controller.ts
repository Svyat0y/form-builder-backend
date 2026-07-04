import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { validationPipeConfig } from '../config/validation.config';
import { UserId } from '../auth/decorators/user-id.decorator';
import { UserRole } from '../users/user.entity';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { PaginatedNotificationsResponse } from './dto/paginated-notifications.response';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
@UsePipes(validationPipeConfig)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's notifications" })
  @ApiResponse({ status: 200, type: PaginatedNotificationsResponse })
  async list(
    @UserId() userId: string,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponse> {
    return this.notificationsService.findAllForUser(userId, query);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Marked as read' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markRead(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserId() userId: string,
  ) {
    await this.notificationsService.markRead(id, userId);
    return { message: 'Notification marked as read' };
  }

  @Post('read-all')
  @ApiOperation({
    summary: "Mark all of the current user's notifications as read",
  })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllRead(@UserId() userId: string) {
    await this.notificationsService.markAllRead(userId);
    return { message: 'All notifications marked as read' };
  }

  @Delete()
  @ApiOperation({ summary: "Clear all of the current user's notifications" })
  @ApiResponse({ status: 200, description: 'All notifications deleted' })
  async removeAll(@UserId() userId: string) {
    await this.notificationsService.removeAll(userId);
    return { message: 'All notifications deleted' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a single notification (own only)' })
  @ApiResponse({ status: 200, description: 'Notification deleted' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UserId() userId: string,
  ) {
    await this.notificationsService.remove(id, userId);
    return { message: 'Notification deleted' };
  }

  @Post('send')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Send an admin message to a user (ADMIN/SUPER_ADMIN)',
  })
  @ApiResponse({ status: 201, description: 'Notification sent' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async send(@Body() dto: SendNotificationDto, @UserId() fromUserId: string) {
    await this.notificationsService.sendAdminMessage(dto, fromUserId);
    return { message: 'Notification sent' };
  }

  @Post('broadcast')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Send an admin message to every user (ADMIN/SUPER_ADMIN)',
  })
  @ApiResponse({
    status: 201,
    description: 'Notification broadcast to all users',
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async broadcast(
    @Body() dto: BroadcastNotificationDto,
    @UserId() fromUserId: string,
  ) {
    const { recipientCount } =
      await this.notificationsService.broadcastAdminMessage(dto, fromUserId);
    return { message: `Notification sent to ${recipientCount} users` };
  }
}
