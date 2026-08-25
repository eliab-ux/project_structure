import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter?: Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const fromEmail = this.configService.get<string>('EMAIL_FROM') ?? 'no-reply@kazatem.shop';
    const fromName = this.configService.get<string>('EMAIL_FROM_NAME') ?? 'Kaza Tem';

    this.from = `${fromName} <${fromEmail}>`;

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: Number(port) === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn(
        'SMTP credentials are incomplete, emails will be logged to console instead of sent.',
      );
    }
  }

  async sendMail(to: string, subject: string, html: string, text?: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`Simulated email -> to=${to} subject=${subject} html=${html}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text,
    });
  }
}
