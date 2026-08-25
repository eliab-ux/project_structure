import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  SystemNotification,
  SystemNotificationResult,
  SystemNotifierPort,
} from '../../contexts/approval/application/ports/output/system-notifier.port';
import {
  MAIL_SENDER,
  MailSenderPort,
} from '../../contexts/auth/application/ports/output/mail-sender.port';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Sends approval notifications through the PLATFORM's channels (§8 item 3).
 *
 * Two deliberate design points:
 *
 *  1. **It never touches EvolutionServerResolver.** The tenant gateway resolves a server per account
 *     (§14 decisão 7); this class reads `EVOLUTION_API_URL` + `EVOLUTION_SYSTEM_INSTANCE` directly and
 *     has no code path to a customer's server. The duplicated HTTP call is the price of making
 *     "nunca por chip de tenant" structurally impossible rather than merely forbidden.
 *
 *  2. **A channel failure never fails the submission.** The approval requests are already persisted by
 *     the time this runs; losing an e-mail means resending a link, while rolling back the submission
 *     because SMTP hiccuped would lose the requests themselves. Failures come back in the result and
 *     the caller reports them.
 */
@Injectable()
export class SystemNotifierAdapter implements SystemNotifierPort {
  private readonly logger = new Logger(SystemNotifierAdapter.name);

  constructor(
    @Inject(MAIL_SENDER) private readonly mail: MailSenderPort,
    private readonly config: ConfigService,
  ) {}

  async notify(notification: SystemNotification): Promise<SystemNotificationResult> {
    const result: SystemNotificationResult = {
      emailSent: false,
      whatsAppSent: false,
      failures: [],
    };

    if (notification.email) {
      try {
        // Mailcow, through the platform's own SMTP — the auth context's mail sender.
        await this.mail.send({
          to: notification.email,
          subject: notification.subject,
          text: notification.body,
        });
        result.emailSent = true;
      } catch (error) {
        result.failures.push(`e-mail: ${(error as Error)?.message ?? 'falha desconhecida'}`);
        // Never log the body: it contains the magic-link token.
        this.logger.warn('Falha ao enviar notificação de aprovação por e-mail');
      }
    }

    if (notification.phoneE164) {
      try {
        await this.sendThroughPlatformInstance(notification.phoneE164, notification.body);
        result.whatsAppSent = true;
      } catch (error) {
        result.failures.push(`whatsapp: ${(error as Error)?.message ?? 'falha desconhecida'}`);
        this.logger.warn('Falha ao enviar notificação de aprovação por WhatsApp');
      }
    }

    return result;
  }

  /**
   * The platform's dedicated instance. Reads platform config only — there is no accountId in scope
   * here, and that is intentional.
   */
  private async sendThroughPlatformInstance(phoneE164: string, text: string): Promise<void> {
    const baseUrl = this.config.get<string>('EVOLUTION_API_URL')?.replace(/\/+$/, '');
    const apiKey = this.config.get<string>('EVOLUTION_API_KEY');
    const instance = this.config.get<string>('EVOLUTION_SYSTEM_INSTANCE');

    if (!baseUrl || !apiKey || !instance) {
      throw new Error(
        'Canal de sistema do WhatsApp não configurado: defina EVOLUTION_API_URL, ' +
          'EVOLUTION_API_KEY e EVOLUTION_SYSTEM_INSTANCE.',
      );
    }

    const response = await axios.post(
      `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`,
      // Digits only: a JID carries no plus sign.
      { number: phoneE164.replace(/\D/g, ''), text },
      {
        timeout: REQUEST_TIMEOUT_MS,
        headers: { apikey: apiKey, 'Content-Type': 'application/json' },
        validateStatus: () => true,
      },
    );

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Evolution respondeu HTTP ${response.status}`);
    }
  }
}
