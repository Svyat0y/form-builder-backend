import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import * as nodemailer from 'nodemailer';

// Form titles are user-authored text (see CreateFormDto) — escape before
// interpolating into HTML so a title like `<b>` or `"onerror=...` can't
// inject markup into the email.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

  async sendNewResponseEmail(
    to: string,
    formTitle: string,
    responsesUrl: string,
  ): Promise<void> {
    const from = this.configService.get<string>('SMTP_FROM');
    const safeTitle = escapeHtml(formTitle);

    await this.transporter.sendMail({
      from: `"Form Builder" <${from}>`,
      to,
      subject: `New response on "${formTitle}"`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
          <h2 style="color: #333; margin-bottom: 4px;">You've got a new response</h2>
          <p style="color: #555;">
            Someone just filled out <strong>${safeTitle}</strong>.
          </p>
          <a href="${responsesUrl}"
             style="display: inline-block; margin: 20px 0; padding: 12px 28px;
                    background: #4f46e5; color: #fff; text-decoration: none;
                    border-radius: 6px; font-size: 15px;">
            View responses
          </a>
          <p style="color: #888; font-size: 13px;">
            You're receiving this because you own this form on Form Builder.
          </p>
        </div>
      `,
    });

    this.logger.log(`NEW_RESPONSE_EMAIL_SENT: ${to}`);
  }

  // ResponsesService emits this after the submit transaction commits — see
  // §6/§7/§9 of the design doc. Mail failures are logged, not thrown: a
  // dropped/failed email shouldn't affect the response that already saved.
  @OnEvent('form.response.created')
  async handleFormResponseCreated(payload: {
    formId: string;
    formTitle: string;
    ownerEmail: string;
    ownerEmailOnResponse: boolean;
  }): Promise<void> {
    if (!payload.ownerEmailOnResponse) {
      return;
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const responsesUrl = `${frontendUrl}/forms/${payload.formId}/responses`;

    try {
      await this.sendNewResponseEmail(
        payload.ownerEmail,
        payload.formTitle,
        responsesUrl,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send new-response email to ${payload.ownerEmail}: ${(error as Error).message}`,
      );
    }
  }
}
