import { ApiProperty } from '@nestjs/swagger';
import { Notification } from '../notification.entity';

export class PaginatedNotificationsResponse {
  @ApiProperty({ type: [Notification] })
  items: Notification[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  unreadCount: number;
}
