import { DomainException } from '@gitspread/domain-primitives';

export class ContactNotFoundException extends DomainException {
  constructor() {
    super('Contato não encontrado.');
  }
}
