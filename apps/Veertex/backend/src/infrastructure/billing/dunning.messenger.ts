import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { DunningMessengerPort } from '../../contexts/billing/application/ports/output/billing-support.ports';
import { DunningRuleInvalidException } from '../../contexts/billing/domain/exceptions/billing-exceptions';

/**
 * Envio da régua (06 §2.3) pela engine da casa: WhatsApp na instância de SISTEMA do Evolution —
 * a MESMA do reset de senha (`EVOLUTION_SYSTEM_INSTANCE`/`EVOLUTION_SYSTEM_APIKEY`): chip de
 * campanha cai; canal de cobrança não pode cair com ele. Canal não configurado RECUSA claro —
 * a proposta continua na tela e o operador sabe por que não saiu; fingir envio seria o defeito.
 *
 * E-mail: fica recusando até o SMTP entrar (a régua nasce WhatsApp-primeiro, como a operação).
 */
@Injectable()
export class EvolutionDunningMessenger implements DunningMessengerPort {
  private readonly logger = new Logger(EvolutionDunningMessenger.name);

  constructor(private readonly config: ConfigService) {}

  async send(params: {
    channel: 'whatsapp' | 'email';
    to: string;
    message: string;
  }): Promise<void> {
    if (params.channel === 'email') {
      throw new DunningRuleInvalidException(
        'Envio por e-mail ainda não configurado (SMTP) — use o canal WhatsApp ou aprove manualmente.',
      );
    }

    const baseUrl = (this.config.get<string>('EVOLUTION_API_URL') ?? '').replace(/\/+$/, '');
    const instance = this.config.get<string>('EVOLUTION_SYSTEM_INSTANCE') ?? '';
    const apikey = this.config.get<string>('EVOLUTION_SYSTEM_APIKEY') ?? '';
    if (!baseUrl || !instance || !apikey) {
      throw new DunningRuleInvalidException(
        'Canal WhatsApp não configurado (EVOLUTION_SYSTEM_*) — a mensagem não saiu.',
      );
    }

    await axios.post(
      `${baseUrl}/message/sendText/${instance}`,
      { number: params.to.replace(/\D/g, ''), text: params.message },
      { headers: { apikey }, timeout: 15_000 },
    );
    // Sem o texto no log — cobrança menciona valor e nome; o evento append-only já guarda o snapshot.
    this.logger.log('Mensagem de cobrança enviada', { channel: params.channel });
  }
}
