import { DomainException } from '@gitspread/domain-primitives';

export class InsufficientStockException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
