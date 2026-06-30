import {
  Controller,
  Get,
  UseGuards,
  UsePipes,
  UseInterceptors,
  Post,
  Patch,
  Delete,
  Body,
  Req,
  UploadedFile,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { validationPipeConfig } from '../config/validation.config';
import { UserResponseDto } from '../dto/user-response.dto';
import { UsersService } from './users.service';
import { DeleteUserDto } from './dto/delete-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { avatarUploadOptions, AVATAR_URL_PREFIX } from './avatar-upload.config';
import { UserId } from '../auth/decorators/user-id.decorator';
import { TokenService } from '../tokens/token.service';
import { UserRole } from './user.entity';

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
            role: 'USER',
          },
          {
            id: 2,
            email: 'user2@example.com',
            name: 'Jane Smith',
            createdAt: '2024-01-15T11:00:00Z',
            role: 'USER',
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
      role: (user as any).role,
      avatar: user.avatar ?? null,
    }));
  }

  @Post('delete')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
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
  async deleteUser(
    @Body() deleteUserDto: DeleteUserDto,
    @UserId() requestingUserId: string,
  ) {
    await this.usersService.deleteUser(deleteUserDto.userId, requestingUserId);
    return { message: 'User deleted successfully' };
  }

  @Patch('update-role')
  @Roles(UserRole.SUPER_ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({
    summary: 'Update user role (SUPER_ADMIN only, cannot change own role)',
  })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
    schema: {
      example: {
        message: 'User role updated successfully',
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'user@example.com',
          name: 'John Doe',
          role: 'ADMIN',
          createdAt: '2024-01-15T10:30:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot change own role or invalid input',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only SUPER_ADMIN can change roles',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserRole(
    @Body() updateRoleDto: UpdateUserRoleDto,
    @UserId() requestingUserId: string,
  ) {
    const updatedUser = await this.usersService.updateUserRole(
      updateRoleDto.userId,
      requestingUserId,
      updateRoleDto.role,
    );

    return {
      message: 'User role updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: (updatedUser as any).role,
        createdAt: updatedUser.createdAt.toISOString(),
        avatar: updatedUser.avatar ?? null,
      },
    };
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
      createdAt: user.createdAt.toISOString(),
      role: (user as any).role,
      avatar: user.avatar ?? null,
    };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile (name)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @UserId() userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const updatedUser = await this.usersService.updateUser(userId, {
      name: updateProfileDto.name,
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      createdAt: updatedUser.createdAt.toISOString(),
      role: (updatedUser as any).role,
      avatar: updatedUser.avatar ?? null,
    };
  }

  @Post('me/avatar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a new avatar for the current user' })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  @ApiResponse({
    status: 400,
    description: 'No file uploaded or invalid file type/size',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  async uploadAvatar(
    @UserId() userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersService.deleteLocalAvatarFile(user.avatar);

    const avatarUrl = `${req.protocol}://${req.get('host')}${AVATAR_URL_PREFIX}${file.filename}`;
    const updatedUser = await this.usersService.updateUser(userId, {
      avatar: avatarUrl,
    });

    return { avatar: updatedUser.avatar };
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Remove the current user avatar' })
  @ApiResponse({ status: 200, description: 'Avatar removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAvatar(@UserId() userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.usersService.deleteLocalAvatarFile(user.avatar);
    await this.usersService.updateUser(userId, { avatar: null });

    return { message: 'Avatar removed successfully' };
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
