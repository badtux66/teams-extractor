import { Injectable, Logger } from '@nestjs/common';
import { MailerPort } from '../application/ports/mailer.port';

/**
 * Development mailer that logs verification/reset links instead of sending.
 * Swap for an SES/SMTP/Resend adapter in production behind the same port.
 */
@Injectable()
export class LogMailerAdapter implements MailerPort {
  private readonly logger = new Logger('Mailer');

  async sendEmailVerification(to: string, token: string): Promise<void> {
    this.logger.log(`[email-verification] to=${to} token=${token}`);
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    this.logger.log(`[password-reset] to=${to} token=${token}`);
  }
}
