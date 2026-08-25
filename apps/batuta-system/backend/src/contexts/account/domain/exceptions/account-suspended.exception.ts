import { DomainException } from '@gitspread/domain-primitives';

export class AccountSuspendedException extends DomainException {
  constructor(reason?: string) {
    super(
      reason ? `Conta suspensa: ${reason}` : 'Conta suspensa. Fale com o suporte para regularizar.',
    );
  }
}
