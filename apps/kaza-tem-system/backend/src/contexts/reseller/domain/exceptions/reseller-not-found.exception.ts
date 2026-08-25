import { DomainException } from '@gitspread/domain-primitives';

export class ResellerNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Reseller not found: ${identifier}`);
  }
}
