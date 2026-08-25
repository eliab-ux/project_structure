import { DomainException } from '@gitspread/domain-primitives';

export class InvalidWithdrawalStatusException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
