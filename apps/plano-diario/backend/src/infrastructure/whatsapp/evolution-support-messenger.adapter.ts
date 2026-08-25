import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  PasswordResetMessage,
  SupportMessengerPort,
} from '../../contexts/auth/application/ports/output/support-messenger.port';
import { SupportChannelUnavailableException } from '../../contexts/auth/domain/exceptions/support-channel-unavailable.exception';
import { WhatsappGatewayException } from '../../contexts/whatsapp/domain/exceptions/whatsapp-gateway.exception';

/** Tudo que precisa estar no ambiente para o canal funcionar. */
const REQUIRED_ENV = [
  'EVOLUTION_API_URL',
  'EVOLUTION_SUPPORT_INSTANCE',
  'EVOLUTION_SUPPORT_APIKEY',
] as const;

/**
 * Fala com o usuário pelo WhatsApp de suporte da operação — a instância **já conectada** na
 * Evolution (o "Suporte PSI"), configurada por env.
 *
 * Duas diferenças em relação ao `EvolutionApiAdapter`, e as duas são intencionais:
 *
 *  - usa a **apikey da instância de suporte**, nunca a chave global: enviar mensagem não precisa
 *    de poder para criar ou apagar instância (menor privilégio);
 *  - o destino é um **telefone**, não um JID de grupo.
 *
 * Esta instância NUNCA é criada, pareada ou apagada por este código: ela é operada à mão no
 * Evolution Manager. Aqui só se envia.
 */
@Injectable()
export class EvolutionSupportMessenger implements SupportMessengerPort, OnApplicationBootstrap {
  private readonly logger = new Logger(EvolutionSupportMessenger.name);
  private readonly http: AxiosInstance;

  private static readonly TIMEOUT_MS = 15_000;

  constructor(private readonly configService: ConfigService) {
    this.http = axios.create({ timeout: EvolutionSupportMessenger.TIMEOUT_MS });
  }

  /**
   * Avisa no boot se o canal está incompleto.
   *
   * **Não derruba a aplicação de propósito**: recuperação de senha é um recurso entre vários, e
   * um `throw` aqui tiraria do ar o envio diário, que é a razão do sistema existir. Mas o silêncio
   * também não serve — sem este aviso a falha só aparecia quando alguém tentava recuperar a senha.
   */
  onApplicationBootstrap(): void {
    const missing = this.missingConfig();
    if (missing.length === 0) {
      this.logger.log('WhatsApp de suporte configurado', {
        // O nome da instância não é segredo; a apikey nunca aparece.
        instance: this.configService.get<string>('EVOLUTION_SUPPORT_INSTANCE'),
      });
      return;
    }
    this.logger.warn(
      `Recuperação de senha DESATIVADA: faltam variáveis de ambiente — ${missing.join(', ')}`,
    );
  }

  ensureAvailable(): void {
    const missing = this.missingConfig();
    if (missing.length > 0) {
      this.logger.error(
        `Recuperação de senha solicitada sem configuração — faltam: ${missing.join(', ')}`,
      );
      throw new SupportChannelUnavailableException();
    }
  }

  async sendPasswordResetCode(message: PasswordResetMessage): Promise<void> {
    this.ensureAvailable();
    const instance = this.requiredConfig('EVOLUTION_SUPPORT_INSTANCE');
    const apikey = this.requiredConfig('EVOLUTION_SUPPORT_APIKEY');

    try {
      await this.http.request({
        method: 'POST',
        baseURL: this.baseUrl(),
        url: `/message/sendText/${encodeURIComponent(instance)}`,
        headers: { apikey },
        data: { number: message.phone, text: this.buildText(message) },
      });
      // O código JAMAIS entra no log. Nem aqui, nem em erro.
      this.logger.log('Código de recuperação enviado pelo WhatsApp de suporte');
    } catch (error) {
      this.logger.error('Falha ao enviar pelo WhatsApp de suporte', {
        status: (error as AxiosError)?.response?.status ?? 'network',
        instance,
      });
      throw new WhatsappGatewayException('enviar o código pelo WhatsApp');
    }
  }

  /**
   * Texto deliberadamente curto e sem link: código que chega junto de um link é o formato que
   * golpista imita. Diz o que fazer, avisa o prazo e orienta quem não pediu.
   */
  private buildText(message: PasswordResetMessage): string {
    return [
      `Olá, ${message.name}!`,
      '',
      `Seu código para redefinir a senha do Plano Diário é *${message.code}*.`,
      '',
      `O código vale por ${message.expiresInMinutes} minutos e só pode ser usado uma vez.`,
      'Se não foi você que pediu, ignore esta mensagem — sua senha continua a mesma.',
    ].join('\n');
  }

  private baseUrl(): string {
    return this.requiredConfig('EVOLUTION_API_URL').replace(/\/+$/, '');
  }

  private missingConfig(): string[] {
    return REQUIRED_ENV.filter((key) => !this.configService.get<string>(key));
  }

  private requiredConfig(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      // Rede de segurança: `ensureAvailable` já barrou antes de chegar aqui.
      throw new SupportChannelUnavailableException();
    }
    return value;
  }
}
