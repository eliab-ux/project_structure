import { DomainException } from '@gitspread/domain-primitives';

export class InvalidOrderStatusException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
