import { DomainException } from '@gitspread/domain-primitives';

/**
 * Falha ao falar com a Evolution API. A mensagem crua do provider NUNCA chega ao cliente —
 * ela pode conter URL com credencial, nome de instância de outro sistema ou stack do servidor.
 */
export class WhatsappGatewayException extends DomainException {
  constructor(operation: string) {
    super(`Não foi possível ${operation}. Tente novamente em alguns instantes.`);
  }
}

/** Falha específica de envio, para o dispatch registrar `failed` com motivo próprio. */
export class WhatsappSendFailedException extends DomainException {
  constructor() {
    super('Não foi possível enviar a mensagem no WhatsApp');
  }
}
