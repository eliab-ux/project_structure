import { DomainException } from '@gitspread/domain-primitives';

export class WithdrawalNotFoundException extends DomainException {
  constructor(id: string) {
    super(`Withdrawal ${id} not found`);
  }
}
