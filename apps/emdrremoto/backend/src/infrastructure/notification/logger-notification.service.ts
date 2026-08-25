import { Injectable, Logger } from '@nestjs/common';
import { NotificationServicePort } from '../../contexts/notification/application/ports/notification-service.port';

/**
 * Default adapter (Fase 0–5): logs the notification instead of sending it. No SMTP/Twilio
 * configured → does not fail. Replaced by the real nodemailer/Twilio adapters in Fase 6.
 * NUNCA loga dados sensíveis além do estritamente necessário para debug (sem senha/token).
 */
@Injectable()
export class LoggerNotificationService implements NotificationServicePort {
  private readonly logger = new Logger(LoggerNotificationService.name);

  async sendEmailVerification(to: string, nome: string, verificationUrl: string): Promise<void> {
    this.logger.log('sendEmailVerification', { to, nome, verificationUrl });
  }

  async sendPasswordRecovery(to: string, nome: string, _code: string): Promise<void> {
    // O código de recuperação é sensível — não logamos o valor.
    this.logger.log('sendPasswordRecovery', { to, nome });
  }

  async sendSessionInvite(params: {
    email: string;
    phone?: string;
    nome: string;
    sessionLink: string;
  }): Promise<void> {
    this.logger.log('sendSessionInvite', {
      email: params.email,
      phone: params.phone,
      nome: params.nome,
      sessionLink: params.sessionLink,
    });
  }
}
