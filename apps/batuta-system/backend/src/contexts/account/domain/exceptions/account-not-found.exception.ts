import { DomainException } from '@gitspread/domain-primitives';

/** Name matters: the GlobalExceptionFilter maps *NotFound* to HTTP 404. */
export class AccountNotFoundException extends DomainException {
  constructor() {
    super('Conta não encontrada.');
  }
}
