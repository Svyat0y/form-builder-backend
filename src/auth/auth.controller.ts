import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Delete,
  Param,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

class RegisterDto {
  email: string;
  name: string;
  password: string;
}

class LoginDto {
  email: string;
  password: string;
}

class RefreshTokenDto {
  refreshToken: string;
}

@Controller('auth')
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
  async logout(@Body() logoutData: { userId: string }) {
    await this.authService.logout(logoutData.userId);
    return { message: 'Logged out successfully' };
  }
}
