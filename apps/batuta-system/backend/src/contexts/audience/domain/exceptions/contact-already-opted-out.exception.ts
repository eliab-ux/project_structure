import { DomainException } from '@gitspread/domain-primitives';

export class ContactAlreadyOptedOutException extends DomainException {
  constructor() {
    super('Este contato já pediu para não receber mensagens.');
  }
}
