import { DomainException } from '@gitspread/domain-primitives';

export class ContactImportNotFoundException extends DomainException {
  constructor() {
    super('Importação não encontrada.');
  }
}
