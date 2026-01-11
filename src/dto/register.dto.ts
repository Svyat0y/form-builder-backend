import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @MaxLength(255, { message: 'Email must be less than 255 characters' })
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'User full name',
    minLength: 2,
    maxLength: 50,
  })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Name must be less than 50 characters' })
  @Matches(/^[a-zA-Zа-яА-ЯёЁ\s'-]+$/, {
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes',
  })
  name: string;

  @ApiProperty({
    example: 'Password123',
    description:
      'User password (min 6 chars, 1 uppercase, 1 lowercase, 1 number)',
    minLength: 6,
    maxLength: 16,
  })
  @IsString({ message: 'Must be a string' })
  @IsNotEmpty({ message: 'Required field' })
  @MinLength(6, { message: 'At least 6 characters' })
  @MaxLength(16, { message: 'Maximum 16 characters' })
  @Matches(/^(?=.*[a-z])/, {
    message: 'Needs a lowercase letter',
  })
  @Matches(/^(?=.*[A-Z])/, {
    message: 'Needs an uppercase letter',
  })
  @Matches(/^(?=.*\d)/, {
    message: 'Needs a number',
  })
  password: string;
}
