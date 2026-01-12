import {
  Controller,
  Get,
  UseGuards,
  UsePipes,
  Post,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { validationPipeConfig } from '../config/validation.config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserResponseDto } from '../dto/user-response.dto';
import { DeleteUserDto } from '../dto/delete-user.dto';
import { UserId } from '../auth/decorators/user-id.decorator';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UsePipes(validationPipeConfig)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
}
