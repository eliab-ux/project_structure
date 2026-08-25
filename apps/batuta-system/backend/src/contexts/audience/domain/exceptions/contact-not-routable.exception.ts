import { DomainException } from '@gitspread/domain-primitives';

export class ContactNotRoutableException extends DomainException {
  constructor() {
    super('Contato inativo ou com opt-out não pode ser roteado.');
  }
}
