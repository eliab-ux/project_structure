import { DomainException } from '@gitspread/domain-primitives';

export class WhatsappNotConfiguredException extends DomainException {
  constructor() {
    super('WhatsApp não configurado. Conecte uma instância antes de enviar mensagens.');
  }
}

export class WhatsappOwnInstanceUnavailableException extends DomainException {
  constructor() {
    super('Criação de instância própria indisponível (chave global do Evolution não configurada).');
  }
}

export class WhatsappSharedUnavailableException extends DomainException {
  constructor() {
    super('Instância compartilhada não configurada no servidor.');
  }
}
