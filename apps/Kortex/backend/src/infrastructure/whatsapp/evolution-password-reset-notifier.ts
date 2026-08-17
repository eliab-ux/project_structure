import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  PasswordResetMessage,
  PasswordResetNotifierPort,
} from '../../contexts/auth/application/ports/output/password-reset-notifier.port';

const SEND_TIMEOUT_MS = 10_000;

/**
 * Envia o código de recuperação pela Evolution API (WhatsApp).
 *
 * Usa a **instância de sistema** e a **apikey DA INSTÂNCIA**, nunca a chave global do servidor:
 * enviar mensagem não precisa de poder para criar ou apagar instância (menor privilégio,
 * CLAUDE.md). E nunca um chip de cliente — chip de campanha cai, e o canal de recuperação de
 * senha não pode cair junto.
 */
@Injectable()
export class EvolutionPasswordResetNotifier implements PasswordResetNotifierPort {
  private readonly logger = new Logger(EvolutionPasswordResetNotifier.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.apiUrl && this.instance && this.apiKey);
  }

  async send(message: PasswordResetMessage): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Canal do WhatsApp não configurado.');
    }

    const url = `${this.apiUrl.replace(/\/+$/, '')}/message/sendText/${this.instance}`;

    await axios.post(
      url,
      // O card padrão do Evolution: `number` em dígitos, sem o '+'.
      { number: message.to.digits, text: this.buildText(message) },
      {
        headers: { apikey: this.apiKey, 'Content-Type': 'application/json' },
        timeout: SEND_TIMEOUT_MS,
      },
    );

    // Só o destino, e ainda assim mascarado. O CÓDIGO jamais entra em log (CLAUDE.md).
    this.logger.log('Código de recuperação enviado', { to: this.maskPhone(message.to.value) });
  }

  /**
   * Texto curto e **sem link de propósito**: código acompanhado de link é exatamente o formato que
   * o golpista imita. Quem recebe aprende que o Kortex nunca manda link junto do código.
   */
  private buildText(message: PasswordResetMessage): string {
    const appName = this.config.get<string>('KORTEX_APP_NAME') ?? 'Kortex';
    return [
      `Olá, ${message.name}!`,
      '',
      `Seu código para redefinir a senha do ${appName} é *${message.code}*.`,
      '',
      `O código vale por ${message.expiresInMinutes} minutos e só pode ser usado uma vez.`,
      'Se não foi você que pediu, ignore esta mensagem — sua senha continua a mesma.',
    ].join('\n');
  }

  /** `+5562998708893` → `+556299****893`. Suficiente para conferir o destino no suporte. */
  private maskPhone(phone: string): string {
    if (phone.length <= 8) {
      return '***';
    }
    return `${phone.slice(0, 8)}****${phone.slice(-3)}`;
  }

  private get apiUrl(): string {
    return this.config.get<string>('EVOLUTION_API_URL') ?? '';
  }

  private get instance(): string {
    return this.config.get<string>('EVOLUTION_SYSTEM_INSTANCE') ?? '';
  }

  private get apiKey(): string {
    return this.config.get<string>('EVOLUTION_SYSTEM_APIKEY') ?? '';
  }
}
