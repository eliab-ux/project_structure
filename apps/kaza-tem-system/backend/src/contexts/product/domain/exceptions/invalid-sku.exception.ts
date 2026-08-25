import { DomainException } from '@gitspread/domain-primitives';

export class InvalidSKUException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
