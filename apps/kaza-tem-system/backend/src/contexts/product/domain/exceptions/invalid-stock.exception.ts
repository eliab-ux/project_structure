import { DomainException } from '@gitspread/domain-primitives';

export class InvalidStockException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
