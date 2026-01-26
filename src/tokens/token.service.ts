import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Token } from './token.entity';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  constructor(
    @InjectRepository(Token)
    private tokenRepository: Repository<Token>,
  ) {}

  async findTokenByDeviceFingerprint(
    userId: string,
    deviceFingerprint: string,
  ): Promise<Token | null> {
    // Ищем существующий токен по deviceFingerprint
    // НЕ проверяем expiresAt, потому что refresh token может быть еще жив
    // даже если access token истек
    return this.tokenRepository.findOne({
      where: {
        userId,
        deviceFingerprint,
        revoked: false,
      },
      relations: ['user'],
      order: {
        lastUsed: 'DESC', // Берем самый свежий, если их несколько
      },
    });
  }

  async getActiveSessionsCount(userId: string): Promise<number> {
    return this.tokenRepository.count({
      where: {
        userId,
        revoked: false,
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async revokeOldestSessions(userId: string, keepCount: number): Promise<void> {
    const activeTokens = await this.tokenRepository.find({
      where: {
        userId,
        revoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        lastUsed: 'ASC',
      },
    });

    if (activeTokens.length > keepCount) {
      const tokensToRevoke = activeTokens.slice(
        0,
        activeTokens.length - keepCount,
      );
      const idsToRevoke = tokensToRevoke.map((token) => token.id);

      await this.tokenRepository.update(
        { id: idsToRevoke as any },
        { revoked: true },
      );

      this.logger.log(
        `Revoked ${tokensToRevoke.length} oldest sessions for user ${userId}`,
      );
    }
  }

  async updateToken(
    tokenId: string,
    accessToken: string,
    refreshToken: string | null,
    expiresIn: number,
  ): Promise<Token> {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await this.tokenRepository.update(tokenId, {
      accessToken,
      refreshToken,
      expiresAt,
      lastUsed: new Date(),
      revoked: false,
    });

    const updatedToken = await this.tokenRepository.findOne({
      where: { id: tokenId },
      relations: ['user'],
    });

    if (!updatedToken) {
      throw new Error(`Token ${tokenId} not found after update`);
    }

    return updatedToken;
  }

  async createToken(
    userId: string,
    accessToken: string,
    refreshToken: string | null,
    expiresIn: number,
    deviceInfo: string,
    ipAddress: string,
    deviceFingerprint: string,
  ): Promise<Token> {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const now = new Date();

    const token = this.tokenRepository.create({
      userId,
      accessToken,
      refreshToken,
      expiresAt,
      deviceInfo,
      ipAddress,
      deviceFingerprint,
      lastUsed: now,
      revoked: false,
    });

    return this.tokenRepository.save(token);
  }

  async findValidAccessToken(accessToken: string): Promise<Token | null> {
    try {
      if (!accessToken) {
        return null;
      }

      const token = await this.tokenRepository.findOne({
        where: {
          accessToken,
          revoked: false,
          expiresAt: MoreThan(new Date()),
        },
        relations: ['user'],
      });

      return token || null;
    } catch (error) {
      this.logger.error(`Error in findValidAccessToken: ${error.message}`);
      return null;
    }
  }

  async findValidRefreshToken(refreshToken: string): Promise<Token | null> {
    return this.tokenRepository.findOne({
      where: {
        refreshToken,
        revoked: false,
        expiresAt: MoreThan(new Date()),
      },
      relations: ['user'],
    });
  }

  async updateLastUsed(tokenId: string): Promise<void> {
    await this.tokenRepository.update(tokenId, {
      lastUsed: new Date(),
    });
  }

  async revokeToken(accessToken: string): Promise<void> {
    await this.tokenRepository.update({ accessToken }, { revoked: true });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.tokenRepository.update(
      { userId, revoked: false },
      { revoked: true },
    );
  }

  async revokeTokenByRefresh(refreshToken: string): Promise<void> {
    await this.tokenRepository.update({ refreshToken }, { revoked: true });
  }

  async cleanupExpiredTokens(): Promise<void> {
    await this.tokenRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now OR revoked = :revoked', {
        now: new Date(),
        revoked: true,
      })
      .execute();
  }

  async getUserActiveSessions(userId: string): Promise<Token[]> {
    return this.tokenRepository.find({
      where: {
        userId,
        revoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        lastUsed: 'DESC',
      },
    });
  }

  async revokeSessionByTokenId(tokenId: string, userId: string): Promise<void> {
    await this.tokenRepository.update(
      { id: tokenId, userId },
      { revoked: true },
    );
  }
}
