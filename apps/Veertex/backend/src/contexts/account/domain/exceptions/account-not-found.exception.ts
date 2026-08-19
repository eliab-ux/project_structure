import { DomainException } from '@gitspread/domain-primitives';

export class AccountNotFoundException extends DomainException {
  constructor() {
    // No identifier echoed: the only caller who could see this message is already authenticated to
    // some account, and naming another one would confirm it exists.
    super('Conta não encontrada.');
  }
}
