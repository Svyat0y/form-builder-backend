import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || '',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || '',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    try {
      const { id, displayName, emails } = profile;
      const email = emails?.[0]?.value;

      if (!email) {
        this.logger.warn('Google profile without email');
        return done(new Error('Email not provided by Google'));
      }

      let user = await this.usersService.findByGoogleId(id);

      if (!user) {
        user = await this.usersService.findByEmail(email);

        if (user && !user.googleId) {
          user.googleId = id;
          await this.usersService.updateUser(user.id, { googleId: id });
          this.logger.log(`Google ID linked to existing user: ${email}`);
        }
      }

      if (!user) {
        user = await this.usersService.createUser(
          email,
          displayName || email.split('@')[0],
          '',
        );
        user.googleId = id;
        await this.usersService.updateUser(user.id, { googleId: id });
        this.logger.log(`New user created via Google: ${email}`);
      }

      done(null, user);
    } catch (error) {
      this.logger.error(`Google validation error: ${error.message}`);
      done(error);
    }
  }
}
