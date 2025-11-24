import { IsString, IsNotEmpty } from 'class-validator';

export class LogoutDto {
  @IsString({ message: 'User ID must be a string' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;
}
