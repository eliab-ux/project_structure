import { DomainException } from '@gitspread/domain-primitives';

export class MissingProvenanceException extends DomainException {
  constructor() {
    super('Informe a base de consentimento e a origem da lista antes de importar.');
  }
}
