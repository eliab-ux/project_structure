import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NOTIFICATION_SERVICE } from '../../contexts/notification/application/ports/notification-service.port';
import { SmtpTwilioNotificationService } from './smtp-twilio-notification.service';

/**
 * Adapter real (Fase 6): nodemailer (SMTP) + Twilio (SMS). Se os canais não estiverem
 * configurados, degrada para log — não falha o fluxo. Trocar o provider é a única mudança
 * necessária para plugar outro provedor (o resto da aplicação não muda).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [{ provide: NOTIFICATION_SERVICE, useClass: SmtpTwilioNotificationService }],
  exports: [NOTIFICATION_SERVICE],
})
export class NotificationModule {}
