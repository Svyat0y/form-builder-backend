import {
  Controller,
  Get,
  UseGuards,
  UsePipes,
  Post,
  Body,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { validationPipeConfig } from '../config/validation.config';
import { UserResponseDto } from '../dto/user-response.dto';
import { UsersService } from './users.service';
import { DeleteUserDto } from './dto/delete-user.dto';
import { UserId } from '../auth/decorators/user-id.decorator';
import { TokenService } from '../tokens/token.service';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('api/users')
@UseGuards(JwtAuthGuard)
@UsePipes(validationPipeConfig)
export class UsersController {
  constructor(
    private usersService: UsersService,
    private tokenService: TokenService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({
    status: 200,
    description: 'Returns array of users',
    type: [UserResponseDto],
    examples: {
      'Example Response': {
        summary: 'Successful response with users array',
        value: [
          {
            id: 1,
            email: 'user1@example.com',
            name: 'John Doe',
            createdAt: '2024-01-15T10:30:00Z',
          },
          {
            id: 2,
            email: 'user2@example.com',
            name: 'Jane Smith',
            createdAt: '2024-01-15T11:00:00Z',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token missing or invalid',
  })
  async getAllUsers(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll();
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    }));
  }

  @Post('delete')
  @ApiOperation({ summary: 'Delete user by ID' })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    schema: {
      example: {
        message: 'User deleted successfully',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid user ID format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Body() deleteUserDto: DeleteUserDto) {
    await this.usersService.deleteUser(deleteUserDto.userId);
    return { message: 'User deleted successfully' };
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  async getCurrentUser(@UserId() userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  @Get('me/sessions')
  @ApiOperation({ summary: 'Get active sessions for current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns array of active sessions',
    schema: {
      example: [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          deviceInfo: 'Chrome on Windows',
          deviceFingerprint: 'abc123def456',
          lastUsed: '2024-01-15T10:30:00Z',
          createdAt: '2024-01-15T09:00:00Z',
          expiresAt: '2024-01-16T09:00:00Z',
          revoked: false,
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMySessions(@UserId() userId: string) {
    const sessions = await this.tokenService.getUserActiveSessions(userId);
    return sessions.map((session) => ({
      id: session.id,
      deviceInfo: session.deviceInfo,
      deviceFingerprint: session.deviceFingerprint,
      lastUsed: session.lastUsed.toISOString(),
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revoked: session.revoked,
    }));
  }
}
