import { DomainException } from '@gitspread/domain-primitives';

export class VariantNotFoundException extends DomainException {
  constructor() {
    super('Variante não encontrada.');
  }
}
