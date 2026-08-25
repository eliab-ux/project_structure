import { DomainException } from '@gitspread/domain-primitives';

export class InvalidWithdrawalAmountException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
