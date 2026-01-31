import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../users/user.entity';

export class UserResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'User unique ID',
  })
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'User full name',
  })
  name: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00Z',
    description: 'User creation timestamp',
  })
  createdAt: string;

  @ApiProperty({
    example: UserRole.USER,
    description: 'User role',
    enum: UserRole,
  })
  role: UserRole;
}
