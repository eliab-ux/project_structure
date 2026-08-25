import { DomainException } from '@gitspread/domain-primitives';

export class DuplicateVariantLabelException extends DomainException {
  constructor() {
    super('Já existe uma variante com este rótulo neste conteúdo.');
  }
}
