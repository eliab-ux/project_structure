import { DomainException } from '@gitspread/domain-primitives';

export class ProductNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Product not found: ${identifier}`);
  }
}
