import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationPrefsDto {
  @ApiProperty({
    example: true,
    description: 'Whether to email the owner when their form gets a new response',
  })
  @IsBoolean({ message: 'emailOnResponse must be a boolean' })
  emailOnResponse: boolean;
}
