import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  private readonly logger = new Logger(FacebookStrategy.name);

  constructor(
    configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      clientID: configService.get<string>('FACEBOOK_APP_ID') || '',
      clientSecret: configService.get<string>('FACEBOOK_APP_SECRET') || '',
      callbackURL: configService.get<string>('FACEBOOK_CALLBACK_URL') || '',
      profileFields: ['id', 'displayName', 'email', 'picture'],
      scope: ['email', 'public_profile'],
      enableProof: true,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (error: any, user?: any) => void,
  ) {
    try {
      const { id, displayName, emails } = profile;
      const email = emails?.[0]?.value;

      if (!email) {
        this.logger.warn('Facebook profile without email');
        return done(new Error('Email not provided by Facebook'));
      }

      let user = await this.usersService.findByFacebookId(id);

      if (!user) {
        user = await this.usersService.findByEmail(email);

        if (user && !user.facebookId) {
          user.facebookId = id;
          await this.usersService.updateUser(user.id, { facebookId: id });
          this.logger.log(`Facebook ID linked to existing user: ${email}`);
        }
      }

      if (!user) {
        user = await this.usersService.createUser(
          email,
          displayName || email.split('@')[0],
          '',
        );
        user.facebookId = id;
        await this.usersService.updateUser(user.id, { facebookId: id });
        this.logger.log(`New user created via Facebook: ${email}`);
      }

      done(null, user);
    } catch (error) {
      this.logger.error(`Facebook validation error: ${error.message}`);
      done(error);
    }
  }
}
