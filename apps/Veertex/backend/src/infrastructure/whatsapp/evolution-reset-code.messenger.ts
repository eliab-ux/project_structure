import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  PasswordResetCodeMessage,
  ResetCodeMessengerPort,
} from '../../contexts/auth/application/ports/output/reset-code-messenger.port';
import { RecoveryChannelUnavailableException } from '../../contexts/auth/domain/exceptions/auth-exceptions';

/**
 * Sends the password-recovery code over the platform's own WhatsApp instance (Evolution API v2).
 *
 * **Uses the INSTANCE apikey, never the server's global key** (CLAUDE.md): sending a message does
 * not require the power to create or delete instances, and the global key is the master credential
 * for the whole Evolution server.
 *
 * **Uses a SYSTEM instance, never a tenant's number.** A customer's chip is paired by the customer
 * and can be disconnected by them; password recovery has to keep working when it is down.
 */
@Injectable()
export class EvolutionResetCodeMessenger implements ResetCodeMessengerPort {
  private readonly logger = new Logger(EvolutionResetCodeMessenger.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      // Ten seconds: past that the user has given up on the form anyway, and the request is holding
      // a connection the API could be using for something a caller is still waiting on.
      timeout: 10_000,
    });
  }

  /**
   * Called BEFORE the user is looked up, so that a broken channel fails the same way for a
   * registered e-mail and an unknown one. Checked later, it would be an account-enumeration oracle.
   */
  ensureAvailable(): void {
    if (!this.baseUrl() || !this.instance() || !this.apiKey()) {
      this.logger.error(
        'Canal de recuperação indisponível: EVOLUTION_API_URL, EVOLUTION_SYSTEM_INSTANCE ou ' +
          'EVOLUTION_SYSTEM_APIKEY ausente no ambiente.',
      );
      throw new RecoveryChannelUnavailableException();
    }
  }

  async sendResetCode(message: PasswordResetCodeMessage): Promise<void> {
    this.ensureAvailable();

    const url = `${this.baseUrl()}/message/sendText/${this.instance()}`;

    await this.http.post(
      url,
      {
        // Evolution expects digits only in the JID — the VO keeps the `+` for storage.
        number: message.phoneE164.replace(/\D/g, ''),
        text: this.buildText(message),
      },
      { headers: { apikey: this.apiKey() as string, 'Content-Type': 'application/json' } },
    );

    // No code, no phone number — not even here, and not even on success (CLAUDE.md, regra de logs).
    this.logger.log('Código de recuperação despachado pelo WhatsApp');
  }

  /**
   * Short, and deliberately WITHOUT a link: a code accompanied by a link is precisely the shape a
   * phishing message imitates, and teaching users to expect one makes the real scam easier.
   */
  private buildText(message: PasswordResetCodeMessage): string {
    const appName = this.config.get<string>('VEERTEX_APP_NAME') ?? 'Veertex';
    return [
      `Olá, ${message.name}!`,
      '',
      `Seu código para redefinir a senha do ${appName} é *${message.code}*.`,
      '',
      `O código vale por ${message.expiresInMinutes} minutos e só pode ser usado uma vez.`,
      'Se não foi você que pediu, ignore esta mensagem — sua senha continua a mesma.',
    ].join('\n');
  }

  private baseUrl(): string | undefined {
    return this.config.get<string>('EVOLUTION_API_URL')?.replace(/\/+$/, '') || undefined;
  }

  private instance(): string | undefined {
    return this.config.get<string>('EVOLUTION_SYSTEM_INSTANCE') || undefined;
  }

  private apiKey(): string | undefined {
    return this.config.get<string>('EVOLUTION_SYSTEM_APIKEY') || undefined;
  }
}
