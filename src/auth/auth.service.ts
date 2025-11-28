import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

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
    const tokens = await this.generateTokens(user.id, user.email);

    await this.usersService.saveRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`USER_REGISTERED: ${email} (ID: ${user.id})`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    };
  }

  async login(email: string, password: string) {
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
    await this.usersService.saveRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`USER_LOGGED_IN: ${email} (ID: ${user.id})`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    };
  }

  private async generateTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ userId, email }, { expiresIn: '60m' }),
      this.jwtService.signAsync({ userId, email }, { expiresIn: '7d' }),
    ]);

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    this.logger.debug('Token refresh attempt');

    const user = await this.usersService.findByRefreshToken(refreshToken);
    if (!user) {
      this.logger.warn('REFRESH_TOKEN_FAILED: Invalid token');
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.usersService.saveRefreshToken(user.id, tokens.refreshToken);

    this.logger.debug(`Tokens refreshed: ${user.email}`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    };
  }

  async logout(userId: string) {
    this.logger.debug(`Logout: ${userId}`);
    await this.usersService.removeRefreshToken(userId);
    this.logger.debug(`User logged out: ${userId}`);
  }
}
