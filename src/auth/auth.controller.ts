import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { validationPipeConfig } from '../config/validation.config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserId } from './decorators/user-id.decorator';

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

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return {
      message:
        'If this email is registered, you will receive a reset link shortly',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Password has been reset successfully' };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiExcludeEndpoint()
  async googleAuth() {
    // Passport redirects to Google OAuth
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiExcludeEndpoint()
  async googleAuthCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const user = req.user as unknown as {
      id: string;
      email: string;
      name: string;
      createdAt: Date;
      role: string;
      avatar: string | null;
      password?: string | null;
    };
    const deviceInfo = (req.headers['user-agent'] as string) || 'Unknown';
    const ipAddress =
      (req.ip as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      'Unknown';

    const tokens = await this.authService.generateTokens(user.id, user.email);

    await this.authService.saveOAuthTokens(
      user.id,
      tokens.accessToken,
      tokens.refreshToken,
      deviceInfo,
      ipAddress,
    );

    this.authService.setRefreshTokenCookie(res, tokens.refreshToken);

    const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${tokens.accessToken}&user=${encodeURIComponent(
      JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        role: user.role,
        avatar: user.avatar,
        hasPassword: !!user.password,
      }),
    )}`;

    res.redirect(frontendUrl);
  }

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  @ApiExcludeEndpoint()
  async facebookAuth() {
    // Passport redirects to Facebook OAuth
  }

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  @ApiExcludeEndpoint()
  async facebookAuthCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const user = req.user as unknown as {
      id: string;
      email: string;
      name: string;
      createdAt: Date;
      role: string;
      avatar: string | null;
      password?: string | null;
    };
    const deviceInfo = (req.headers['user-agent'] as string) || 'Unknown';
    const ipAddress =
      (req.ip as string) ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      'Unknown';

    const tokens = await this.authService.generateTokens(user.id, user.email);

    await this.authService.saveOAuthTokens(
      user.id,
      tokens.accessToken,
      tokens.refreshToken,
      deviceInfo,
      ipAddress,
    );

    this.authService.setRefreshTokenCookie(res, tokens.refreshToken);

    const frontendUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${tokens.accessToken}&user=${encodeURIComponent(
      JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        role: user.role,
        avatar: user.avatar,
        hasPassword: !!user.password,
      }),
    )}`;

    res.redirect(frontendUrl);
  }
}
