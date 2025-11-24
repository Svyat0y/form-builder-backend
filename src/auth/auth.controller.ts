import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
  Get,
  UseGuards, BadRequestException, ValidationPipe, UsePipes,
} from '@nestjs/common';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

class RegisterDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @MaxLength(255, { message: 'Email must be less than 255 characters' })
  email: string;

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(50, { message: 'Name must be less than 50 characters' })
  @Matches(/^[a-zA-Zа-яА-ЯёЁ\s'-]+$/, {
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes',
  })
  name: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(16, { message: 'Password must be less than 100 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one lowercase letter, one uppercase letter, and one number',
  })
  password: string;
}

class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}

class RefreshTokenDto {
  @IsString({ message: 'Refresh token must be a string' })
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken: string;
}

class LogoutDto {
  @IsString({ message: 'User ID must be a string' })
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;
}

@Controller('auth')
@UsePipes(
  new ValidationPipe({
    whitelist: true, // удаляет поля которых нет в DTO
    forbidNonWhitelisted: true, // выбрасывает ошибку если есть лишние поля
    transform: true, // автоматически преобразует типы
    exceptionFactory: (errors) => {
      // Кастомные сообщения об ошибках
      const messages = errors.map((error) => ({
        field: error.property,
        message: Object.values(error.constraints || {}).join(', '),
      }));
      return new BadRequestException({
        message: 'Validation failed',
        errors: messages,
      });
    },
  }),
)
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async register(@Body() registerData: RegisterDto) {
    const user = await this.authService.register(
      registerData.email,
      registerData.name,
      registerData.password,
    );
    return { message: 'User registered successfully', user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() loginData: LoginDto) {
    const user = await this.authService.login(
      loginData.email,
      loginData.password,
    );
    return { message: 'Login successful', user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(@Body() refreshData: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshData.refreshToken);
  }

  @Delete('user/:id')
  @UseGuards(JwtAuthGuard)
  async deleteUser(@Param('id') id: string) {
    await this.usersService.deleteUser(id);
    return { message: 'User deleted successfully' };
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  async getAllUsers() {
    const users = await this.usersService.findAll();
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    }));
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Body() logoutData: LogoutDto) {
    await this.authService.logout(logoutData.userId);
    return { message: 'Logged out successfully' };
  }
}
