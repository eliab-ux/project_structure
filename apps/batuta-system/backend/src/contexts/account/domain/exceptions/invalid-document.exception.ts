import { DomainException } from '@gitspread/domain-primitives';

export class InvalidDocumentException extends DomainException {
  constructor() {
    // Never echoes the offending value — it is personal data (CPF/CNPJ).
    super('Documento inválido. Informe um CPF ou CNPJ válido.');
  }
}
