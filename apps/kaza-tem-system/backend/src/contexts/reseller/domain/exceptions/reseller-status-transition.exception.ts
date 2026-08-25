import { DomainException } from '@gitspread/domain-primitives';

export class ResellerStatusTransitionException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
