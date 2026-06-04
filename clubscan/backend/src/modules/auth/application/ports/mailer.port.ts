export const MAILER = Symbol('MAILER');

/** Outbound transactional email. v1 ships a log-based dev adapter. */
export interface MailerPort {
  sendEmailVerification(to: string, token: string): Promise<void>;
  sendPasswordReset(to: string, token: string): Promise<void>;
}
