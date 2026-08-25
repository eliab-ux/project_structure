import { DomainException } from '@gitspread/domain-primitives';

export class ResellerAlreadyExistsException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
