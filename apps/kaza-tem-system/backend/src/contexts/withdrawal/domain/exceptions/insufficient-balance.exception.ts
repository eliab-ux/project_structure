import { DomainException } from '@gitspread/domain-primitives';

export class InsufficientBalanceException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
