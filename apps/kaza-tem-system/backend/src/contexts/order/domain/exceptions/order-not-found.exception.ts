import { DomainException } from '@gitspread/domain-primitives';

export class OrderNotFoundException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
