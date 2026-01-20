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

  async createToken(
    userId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn: number = 3600,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<Token> {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const token = this.tokenRepository.create({
      userId,
      accessToken,
      refreshToken: refreshToken || null,
      expiresAt,
      deviceInfo: deviceInfo || null,
      ipAddress: ipAddress || null,
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
        expiresAt: new Date(),
      },
      relations: ['user'],
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
}
