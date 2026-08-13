import { DomainException } from '@veertex/domain-primitives';

export class InvalidDocumentException extends DomainException {
  constructor(message = 'CPF/CNPJ inválido.') {
    // The document itself is never interpolated into the message — it is personal data (CLAUDE.md).
    super(message);
  }
}
