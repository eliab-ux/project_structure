import { DomainException } from '@gitspread/domain-primitives';

export class ContentNotEditableException extends DomainException {
  constructor() {
    super('Conteúdo arquivado não pode mais ser editado.');
  }
}
