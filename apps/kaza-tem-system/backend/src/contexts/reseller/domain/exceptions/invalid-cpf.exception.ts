import { DomainException } from '@gitspread/domain-primitives';

export class InvalidCPFException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
