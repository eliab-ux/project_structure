import { DomainException } from '@gitspread/domain-primitives';

export class InvalidSubscriptionStatusException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
