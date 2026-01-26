import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    example: 'Password123',
    description: 'User password',
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'If true, refresh token will be set in httpOnly cookie for 7 days',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean = false;
}
