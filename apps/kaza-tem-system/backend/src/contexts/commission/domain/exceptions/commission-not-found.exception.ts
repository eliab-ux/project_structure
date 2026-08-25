import { DomainException } from '@gitspread/domain-primitives';

export class CommissionNotFoundException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
