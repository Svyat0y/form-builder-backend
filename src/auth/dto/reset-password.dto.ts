import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token from email link' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'NewPassword1',
    description:
      'New password (min 6 chars, 1 uppercase, 1 lowercase, 1 number)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'At least 6 characters' })
  @MaxLength(16, { message: 'Maximum 16 characters' })
  @Matches(/(?=.*[a-z])/, { message: 'Needs a lowercase letter' })
  @Matches(/(?=.*[A-Z])/, { message: 'Needs an uppercase letter' })
  @Matches(/(?=.*\d)/, { message: 'Needs a number' })
  password: string;
}
