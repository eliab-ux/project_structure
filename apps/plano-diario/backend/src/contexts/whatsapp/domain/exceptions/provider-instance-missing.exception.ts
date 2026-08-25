import { DomainException } from '@gitspread/domain-primitives';

/**
 * A instância existe no nosso banco mas **não existe mais no provedor** — apagada no Evolution
 * Manager, perdida numa recriação do container, ou removida por um logout que deletou o registro.
 *
 * É um estado real e recuperável, não uma falha de comunicação: o `ConnectWhatsappUseCase` a
 * captura e recria a instância. Se algum dia escapar até o cliente, a mensagem ainda faz sentido.
 */
export class ProviderInstanceMissingException extends DomainException {
  constructor() {
    super('A conexão do WhatsApp não existe mais no servidor. Gere um QR Code novo para parear.');
  }
}
