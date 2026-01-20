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
import { TokenService } from '../tokens/token.service';
import { TOKEN_CONSTANTS } from '../tokens/token.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private tokenService: TokenService,
  ) {}

  private async generateTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { userId, email },
        { expiresIn: TOKEN_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN },
      ),
      this.jwtService.signAsync(
        { userId, email },
        { expiresIn: TOKEN_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: TOKEN_CONSTANTS.REFRESH_TOKEN_COOKIE_MAX_AGE,
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
    deviceInfo?: string,
    ipAddress?: string,
  ) {
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

    await this.tokenService.revokeAllUserTokens(user.id);

    const tokens = await this.generateTokens(user.id, user.email);

    await this.tokenService.createToken(
      user.id,
      tokens.accessToken,
      rememberMe ? tokens.refreshToken : undefined,
      TOKEN_CONSTANTS.ACCESS_TOKEN_DB_EXPIRATION,
      deviceInfo,
      ipAddress,
    );

    if (rememberMe) {
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

    const tokenEntity =
      await this.tokenService.findValidRefreshToken(refreshToken);

    if (!tokenEntity) {
      this.logger.warn('REFRESH_TOKEN_FAILED: Token not found');
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenEntity.revoked) {
      this.logger.warn(
        `POSSIBLE_TOKEN_THEFT: Revoked refresh token used for user ${tokenEntity.userId}`,
      );
      await this.tokenService.revokeAllUserTokens(tokenEntity.userId);
      throw new UnauthorizedException('Security violation detected');
    }

    await this.tokenService.revokeTokenByRefresh(refreshToken);

    const tokens = await this.generateTokens(
      tokenEntity.user.id,
      tokenEntity.user.email,
    );

    const hadRefreshToken = !!tokenEntity.refreshToken;

    await this.tokenService.createToken(
      tokenEntity.user.id,
      tokens.accessToken,
      hadRefreshToken ? tokens.refreshToken : undefined,
      TOKEN_CONSTANTS.ACCESS_TOKEN_DB_EXPIRATION,
    );

    if (hadRefreshToken && res) {
      this.setRefreshTokenCookie(res, tokens.refreshToken);
    }

    this.logger.debug(`Tokens refreshed: ${tokenEntity.user.email}`);

    return {
      user: {
        id: tokenEntity.user.id,
        email: tokenEntity.user.email,
        name: tokenEntity.user.name,
        createdAt: tokenEntity.user.createdAt,
        accessToken: tokens.accessToken,
      },
    };
  }

  async logout(userId: string, accessToken?: string, res?: Response) {
    this.logger.debug(`Logout: ${userId}`);

    if (accessToken) {
      await this.tokenService.revokeToken(accessToken);

      const tokenEntity =
        await this.tokenService.findValidAccessToken(accessToken);
      if (tokenEntity?.refreshToken) {
        await this.tokenService.revokeTokenByRefresh(tokenEntity.refreshToken);
      }
    } else {
      await this.tokenService.revokeAllUserTokens(userId);
    }

    if (res) {
      this.clearRefreshTokenCookie(res);
    }

    this.logger.debug(`User logged out: ${userId}`);
  }
}
