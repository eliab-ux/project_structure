import { DomainException } from '@gitspread/domain-primitives';

export class InvalidPhoneNumberException extends DomainException {
  constructor() {
    // Mensagem de negócio, segura para o cliente ver: diz o que é aceito sem ecoar o que veio.
    super('Informe um número de WhatsApp válido com DDD, no formato (11) 91234-5678.');
  }
}
