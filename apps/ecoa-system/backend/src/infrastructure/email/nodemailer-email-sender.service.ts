import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailSenderPort } from '../../contexts/auth/application/ports/output/email-sender.port';

@Injectable()
export class NodemailerEmailSender implements EmailSenderPort {
  private readonly logger = new Logger(NodemailerEmailSender.name);

  constructor(private readonly configService: ConfigService) {}

  async sendPasswordReset(to: string, name: string, resetLink: string): Promise<void> {
    const host = this.configService.get<string>('SMTP_HOST');
    const from = this.configService.get<string>('SMTP_FROM', 'no-reply@ecoa.app');

    if (!host) {
      // No SMTP configured (dev) — log the link instead of failing the flow.
      this.logger.warn(`SMTP não configurado. Link de reset para ${to}: ${resetLink}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port: this.configService.get<number>('SMTP_PORT', 587),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASSWORD'),
      },
    });

    await transporter.sendMail({
      from,
      to,
      subject: 'Redefinição de senha — Ecoa',
      html: `
        <p>Olá, ${name}.</p>
        <p>Recebemos um pedido para redefinir sua senha. Clique no link abaixo (válido por 1 hora):</p>
        <p><a href="${resetLink}">Redefinir senha</a></p>
        <p>Se você não solicitou, ignore este e-mail.</p>
      `,
    });
  }
}
