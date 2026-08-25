export const MAIL_SENDER = Symbol('MAIL_SENDER');

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Transactional e-mail. Goes out through the platform's own SMTP (Mailcow) — a SYSTEM channel,
 * never a tenant's WhatsApp chip (BATUTA_SPEC §1.7).
 */
export interface MailSenderPort {
  send(message: MailMessage): Promise<void>;
}
