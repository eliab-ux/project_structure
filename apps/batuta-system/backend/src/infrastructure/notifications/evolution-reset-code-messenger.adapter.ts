import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  PasswordResetCodeMessage,
  ResetCodeMessengerPort,
} from '../../contexts/auth/application/ports/output/reset-code-messenger.port';
import { RecoveryChannelUnavailableException } from '../../contexts/auth/domain/exceptions/recovery-channel-unavailable.exception';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Sends the recovery code through the PLATFORM's own WhatsApp instance on the Evolution API.
 *
 * Two things it deliberately does NOT do:
 *
 *  1. **It never touches the per-account Evolution server resolver.** A tenant chip is paired by the
 *     customer, can be disconnected by the customer and can be degraded by the throttle; recovery
 *     has to work when every chip of the account is down. This class reads platform configuration
 *     only, and there is no argument anyone could pass to route a code through a customer's number.
 *
 *  2. **It never puts a link in the message.** A code arriving next to a link is precisely the shape
 *     a phishing message imitates; teaching users that the real one has no link is worth more than
 *     the convenience.
 *
 * Uses `POST /message/sendText/{instância}` with `{ number, text }` and the **instance** apikey —
 * the standard Evolution send (the same call EMDR and Plano Diário make).
 */
@Injectable()
export class EvolutionResetCodeMessenger implements ResetCodeMessengerPort, OnApplicationBootstrap {
  private readonly logger = new Logger(EvolutionResetCodeMessenger.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({ timeout: REQUEST_TIMEOUT_MS });
  }

  /**
   * Warns at boot when the channel is incomplete — and does NOT abort the boot.
   *
   * A `throw` here would take down sending, the inbox and every screen because password recovery is
   * misconfigured, which is a worse outcome than a degraded recovery. But silence is not acceptable
   * either: without this line, the failure would only surface the day somebody forgot a password.
   */
  onApplicationBootstrap(): void {
    const missing = this.missingConfig();
    if (missing.length > 0) {
      this.logger.warn(
        `Recuperação de senha DESATIVADA: faltam variáveis de ambiente — ${missing.join(', ')}`,
      );
      return;
    }

    // The instance name is not a secret; the apikey never appears in a log.
    this.logger.log('Canal de recuperação de senha configurado', {
      instance: this.config.get<string>('EVOLUTION_SYSTEM_INSTANCE'),
      scopedKey: Boolean(this.config.get<string>('EVOLUTION_SYSTEM_APIKEY')),
    });

    if (!this.config.get<string>('EVOLUTION_SYSTEM_APIKEY')) {
      this.logger.warn(
        'EVOLUTION_SYSTEM_APIKEY ausente: o envio do código usará a chave GLOBAL do Evolution. ' +
          'Funciona, mas dá ao envio um poder que ele não precisa (criar e apagar instâncias). ' +
          'Defina a apikey da instância de sistema.',
      );
    }
  }

  ensureAvailable(): void {
    const missing = this.missingConfig();
    if (missing.length > 0) {
      // The precise cause goes to the log; the client gets a message that names nothing.
      this.logger.error(
        `Recuperação de senha solicitada sem configuração — faltam: ${missing.join(', ')}`,
      );
      throw new RecoveryChannelUnavailableException();
    }
  }

  async sendResetCode(message: PasswordResetCodeMessage): Promise<void> {
    this.ensureAvailable();

    const baseUrl = this.requiredConfig('EVOLUTION_API_URL').replace(/\/+$/, '');
    const instance = this.requiredConfig('EVOLUTION_SYSTEM_INSTANCE');
    const apiKey = this.apiKey();

    try {
      const response = await this.http.post(
        `${baseUrl}/message/sendText/${encodeURIComponent(instance)}`,
        // Digits only: a JID carries no plus sign.
        { number: message.phoneE164.replace(/\D/g, ''), text: this.buildText(message) },
        {
          headers: { apikey: apiKey, 'Content-Type': 'application/json' },
          // Let every status through so the message below carries the real code instead of axios's.
          validateStatus: () => true,
        },
      );

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Evolution respondeu HTTP ${response.status}`);
      }

      // Neither the code nor the number is ever logged — not here, not on the failure path.
      this.logger.log('Código de recuperação enviado pelo WhatsApp da plataforma');
    } catch (error) {
      this.logger.error('Falha ao enviar o código de recuperação pelo WhatsApp', {
        status: (error as AxiosError)?.response?.status ?? 'network',
        instance,
      });
      // Propagates so the caller does NOT mark the code as sent: it must not consume the user's
      // hourly quota when no message left.
      throw new Error('Falha ao enviar o código pelo WhatsApp');
    }
  }

  /**
   * Short, and with no link on purpose. Says what to do, states the deadline, and tells whoever did
   * not ask for it that nothing has changed.
   */
  private buildText(message: PasswordResetCodeMessage): string {
    const appName = this.config.get<string>('BATUTA_APP_NAME') ?? 'Batuta';
    return [
      `Olá, ${message.name}!`,
      '',
      `Seu código para redefinir a senha do ${appName} é *${message.code}*.`,
      '',
      `O código vale por ${message.expiresInMinutes} minutos e só pode ser usado uma vez.`,
      'Se não foi você que pediu, ignore esta mensagem — sua senha continua a mesma.',
    ].join('\n');
  }

  /**
   * Prefers the instance apikey (Least Privilege: sending a message needs no power to create or
   * delete instances). Falls back to the global key so an environment configured before this
   * variable existed keeps working — `onApplicationBootstrap` says so out loud.
   */
  private apiKey(): string {
    const scoped = this.config.get<string>('EVOLUTION_SYSTEM_APIKEY');
    return scoped ?? this.requiredConfig('EVOLUTION_API_KEY');
  }

  private missingConfig(): string[] {
    const missing: string[] = [];
    if (!this.config.get<string>('EVOLUTION_API_URL')) {
      missing.push('EVOLUTION_API_URL');
    }
    if (!this.config.get<string>('EVOLUTION_SYSTEM_INSTANCE')) {
      missing.push('EVOLUTION_SYSTEM_INSTANCE');
    }
    if (
      !this.config.get<string>('EVOLUTION_SYSTEM_APIKEY') &&
      !this.config.get<string>('EVOLUTION_API_KEY')
    ) {
      missing.push('EVOLUTION_SYSTEM_APIKEY (ou EVOLUTION_API_KEY)');
    }
    return missing;
  }

  private requiredConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      // Safety net: `ensureAvailable` already refused before reaching here.
      throw new RecoveryChannelUnavailableException();
    }
    return value;
  }
}
