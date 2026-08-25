import { DomainException } from '@gitspread/domain-primitives';

export class InvalidPriceException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
