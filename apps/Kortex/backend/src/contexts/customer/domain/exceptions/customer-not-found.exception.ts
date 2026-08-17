import { DomainException } from '@gitspread/domain-primitives';

export class CustomerNotFoundException extends DomainException {
  constructor() {
    super('Cliente não encontrado.');
  }
}
