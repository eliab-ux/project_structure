import { DomainException } from '@gitspread/domain-primitives';

export class PendingWithdrawalExistsException extends DomainException {
  constructor() {
    super('A withdrawal is already pending approval.');
  }
}
