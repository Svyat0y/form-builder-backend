import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM');

    await this.transporter.sendMail({
      from: `"Form Builder" <${from}>`,
      to,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
          <h2 style="color: #333;">Reset your password</h2>
          <p>Click the button below to set a new password. The link expires in <strong>1 hour</strong>.</p>
          <a href="${resetLink}"
             style="display: inline-block; margin: 20px 0; padding: 12px 28px;
                    background: #4f46e5; color: #fff; text-decoration: none;
                    border-radius: 6px; font-size: 15px;">
            Reset Password
          </a>
          <p style="color: #888; font-size: 13px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    this.logger.log(`PASSWORD_RESET_EMAIL_SENT: ${to}`);
  }
}
