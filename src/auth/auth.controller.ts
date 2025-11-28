import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { validationPipeConfig } from '../config/validation.config';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { UserId } from './decorators/user-id.decorator';

@ApiTags('Auth')
@ApiBearerAuth('JWT-auth')
@Controller('auth')
@UsePipes(validationPipeConfig)
export class AuthController {
  constructor(private authService: AuthService) {}

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
  @ApiExcludeEndpoint()
  async refresh(@Body() refreshData: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshData.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@UserId() userId: string) {
    await this.authService.logout(userId);
    return { message: 'Logged out successfully' };
  }
}
