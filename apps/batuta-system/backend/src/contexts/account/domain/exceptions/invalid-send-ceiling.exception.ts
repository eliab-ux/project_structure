import { DomainException } from '@gitspread/domain-primitives';

export class InvalidSendCeilingException extends DomainException {
  constructor() {
    super('Teto diário de envio deve ser um inteiro maior que zero.');
  }
}
