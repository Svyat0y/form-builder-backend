import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';

const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRES_IN: '60m',
  REFRESH_TOKEN_EXPIRES_IN: '7d',
  REFRESH_TOKEN_COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000,
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  private async generateTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { userId, email },
        { expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRES_IN },
      ),
      this.jwtService.signAsync(
        { userId, email },
        { expiresIn: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRES_IN },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TOKEN_CONFIG.REFRESH_TOKEN_COOKIE_MAX_AGE,
      path: '/',
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie('refreshToken', {
      path: '/',
    });
  }

  async register(email: string, name: string, password: string) {
    this.logger.debug(`Registration attempt: ${email}`);

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      this.logger.warn(`Registration failed - email exists: ${email}`);
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await this.usersService.createUser(
      email,
      name,
      hashedPassword,
    );

    this.logger.log(`USER_REGISTERED: ${email} (ID: ${user.id})`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    };
  }

  async login(
    email: string,
    password: string,
    rememberMe: boolean = false,
    res?: Response,
  ) {
    this.logger.debug(`Login attempt: ${email}`);

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.warn(`LOGIN_FAILED: User not found - ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`LOGIN_FAILED: Invalid password - ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    if (rememberMe) {
      await this.usersService.saveRefreshToken(user.id, tokens.refreshToken);

      if (res) {
        this.setRefreshTokenCookie(res, tokens.refreshToken);
      }
    } else {
      if (res) {
        this.clearRefreshTokenCookie(res);
      }
    }

    this.logger.log(`USER_LOGGED_IN: ${email} (ID: ${user.id})`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        accessToken: tokens.accessToken,
      },
    };
  }

  async refreshTokens(refreshToken: string, res?: Response) {
    this.logger.debug('Token refresh attempt');

    const user = await this.usersService.findByRefreshToken(refreshToken);
    if (!user) {
      this.logger.warn('REFRESH_TOKEN_FAILED: Invalid token');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    await this.usersService.saveRefreshToken(user.id, tokens.refreshToken);

    if (res) {
      this.setRefreshTokenCookie(res, tokens.refreshToken);
    }

    this.logger.debug(`Tokens refreshed: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        accessToken: tokens.accessToken,
      },
    };
  }

  async logout(userId: string, res?: Response) {
    this.logger.debug(`Logout: ${userId}`);

    await this.usersService.removeRefreshToken(userId);

    if (res) {
      this.clearRefreshTokenCookie(res);
    }

    this.logger.debug(`User logged out: ${userId}`);
  }
}
