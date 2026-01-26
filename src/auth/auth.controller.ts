import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { validationPipeConfig } from '../config/validation.config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { UserId } from './decorators/user-id.decorator';
import type { Response, Request } from 'express';

@ApiTags('Auth')
@Controller('api/auth')
@UsePipes(validationPipeConfig)
@ApiBearerAuth('JWT-auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  async register(@Body() registerData: RegisterDto) {
    const result = await this.authService.register(
      registerData.email,
      registerData.name,
      registerData.password,
    );

    return {
      message: 'User registered successfully',
      user: result.user,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginData: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const deviceInfo = req.headers['user-agent'] || 'Unknown';

    const ipAddress =
      req.ip ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket.remoteAddress;

    const result = await this.authService.login(
      loginData.email,
      loginData.password,
      loginData.rememberMe,
      res,
      deviceInfo,
      ipAddress,
    );

    return { message: 'Login successful', user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiExcludeEndpoint()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies as { refreshToken?: string })
      ?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }
    const result = await this.authService.refreshTokens(refreshToken, res);

    return {
      message: 'Tokens refreshed successfully',
      user: result.user,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @UserId() userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace('Bearer ', '');

    await this.authService.logout(userId, accessToken, res);

    return { message: 'Logged out successfully' };
  }
}
