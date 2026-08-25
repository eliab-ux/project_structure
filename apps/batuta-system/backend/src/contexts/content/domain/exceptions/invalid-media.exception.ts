import { DomainException } from '@gitspread/domain-primitives';

export class InvalidMediaException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
