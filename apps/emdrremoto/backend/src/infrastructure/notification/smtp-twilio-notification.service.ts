import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import twilio from 'twilio';
import { NotificationServicePort } from '../../contexts/notification/application/ports/notification-service.port';

/**
 * Adapter real de notificações: e-mail via nodemailer (SMTP) e SMS via Twilio.
 * Se um canal não estiver configurado, degrada para log (não falha o fluxo de negócio).
 * NUNCA loga dados sensíveis (código de recuperação, tokens).
 */
@Injectable()
export class SmtpTwilioNotificationService implements NotificationServicePort {
  private readonly logger = new Logger(SmtpTwilioNotificationService.name);

  constructor(private readonly config: ConfigService) {}

  async sendEmailVerification(to: string, nome: string, verificationUrl: string): Promise<void> {
    await this.sendEmail(
      to,
      'Confirme seu e-mail — EMDR Remoto',
      `<p>Olá, ${nome}!</p><p>Confirme seu e-mail para ativar sua conta:</p>
       <p><a href="${verificationUrl}">Confirmar e-mail</a></p>`,
    );
  }

  async sendPasswordRecovery(to: string, nome: string, code: string): Promise<void> {
    await this.sendEmail(
      to,
      'Recuperação de senha — EMDR Remoto',
      `<p>Olá, ${nome}!</p><p>Seu código de recuperação é:</p>
       <p style="font-size:20px;font-weight:bold">${code}</p>
       <p>Se você não solicitou, ignore este e-mail.</p>`,
    );
  }

  async sendSessionInvite(params: {
    email: string;
    phone?: string;
    nome: string;
    sessionLink: string;
  }): Promise<void> {
    await this.sendEmail(
      params.email,
      'Convite para sua sessão — EMDR Remoto',
      `<p>Olá, ${params.nome}!</p><p>Seu psicólogo iniciou uma sessão. Acesse pelo link:</p>
       <p><a href="${params.sessionLink}">Entrar na sessão</a></p>`,
    );
    if (params.phone) {
      await this.sendSms(
        params.phone,
        `EMDR Remoto: sua sessão está pronta. Acesse: ${params.sessionLink}`,
      );
    }
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn('SMTP não configurado — e-mail não enviado (dev).', { to, subject });
      return;
    }
    const transport = nodemailer.createTransport({
      host,
      port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASSWORD'),
      },
    });
    await transport.sendMail({
      from: this.config.get<string>('SMTP_FROM') ?? 'no-reply@emdrremoto.com.br',
      to,
      subject,
      html,
    });
  }

  private async sendSms(to: string, body: string): Promise<void> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_FROM_NUMBER');
    if (!sid || !token || !from) {
      this.logger.warn('Twilio não configurado — SMS não enviado (dev).', { to });
      return;
    }
    const client = twilio(sid, token);
    await client.messages.create({ from, to, body });
  }
}
