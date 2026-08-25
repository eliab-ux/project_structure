import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  MailMessage,
  MailSenderPort,
} from '../../contexts/auth/application/ports/output/mail-sender.port';

/**
 * Transactional e-mail over the platform's own SMTP (Mailcow, port 465 with direct SSL).
 *
 * This is a SYSTEM channel: approval notifications, alerts and password resets never travel
 * through a tenant's WhatsApp chip (BATUTA_SPEC §1.7) — a campaign chip goes down, the system
 * channel must not go down with it.
 */
@Injectable()
export class NodemailerMailSender implements MailSenderPort, OnModuleInit {
  private readonly logger = new Logger(NodemailerMailSender.name);
  private transporter?: Transporter;
  private from?: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    this.from = this.config.get<string>('SMTP_FROM') ?? user;

    if (!host || !user || !pass || !this.from) {
      // Not an error: e-mail is simply not configured in this environment.
      this.logger.warn('SMTP não configurado — e-mails falharão até definir SMTP_* no .env');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get<number>('SMTP_PORT') ?? 465),
      secure: this.config.get<boolean>('SMTP_SECURE') ?? true,
      auth: { user, pass },
    });
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter || !this.from) {
      throw new Error('E-mail não configurado: defina SMTP_HOST, SMTP_USER e SMTP_PASSWORD.');
    }

    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    // Recipient and subject only — never the body, which can carry a reset link.
    this.logger.log('E-mail enviado', { subject: message.subject });
  }
}
