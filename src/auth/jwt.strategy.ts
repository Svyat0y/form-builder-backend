// auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../tokens/token.service';

interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private tokenService: TokenService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new UnauthorizedException('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const authHeader = req.headers['authorization'];
    const accessToken = authHeader?.replace('Bearer ', '');

    this.logger.debug(`Validating JWT for user: ${payload.userId}`);
    this.logger.debug(
      `Access token from header: ${accessToken?.substring(0, 30)}...`,
    );

    if (!accessToken) {
      this.logger.warn('No access token in Authorization header');
      throw new UnauthorizedException('Token not found');
    }

    // Проверяем токен в БД
    const tokenInDb = await this.tokenService.findValidAccessToken(accessToken);

    this.logger.debug(`Token found in DB: ${!!tokenInDb}`);

    if (tokenInDb) {
      this.logger.debug(`Token ID in DB: ${tokenInDb.id}`);
      this.logger.debug(`Token revoked: ${tokenInDb.revoked}`);
      this.logger.debug(`Token expires at: ${tokenInDb.expiresAt}`);
      this.logger.debug(`Current time: ${new Date()}`);
      this.logger.debug(
        `Is token expired? ${tokenInDb.expiresAt < new Date()}`,
      );
    }

    if (!tokenInDb) {
      this.logger.warn(
        `Token NOT FOUND in database for user ${payload.userId}`,
      );
      throw new UnauthorizedException('Token revoked or expired');
    }

    if (tokenInDb.revoked) {
      this.logger.warn(`Token REVOKED in database for user ${payload.userId}`);
      throw new UnauthorizedException('Token revoked or expired');
    }

    if (tokenInDb.expiresAt < new Date()) {
      this.logger.warn(`Token EXPIRED for user ${payload.userId}`);
      throw new UnauthorizedException('Token revoked or expired');
    }

    this.logger.debug(`Token validation SUCCESS for user ${payload.userId}`);

    return {
      userId: payload.userId,
      email: payload.email,
      tokenId: tokenInDb.id,
    };
  }
}
