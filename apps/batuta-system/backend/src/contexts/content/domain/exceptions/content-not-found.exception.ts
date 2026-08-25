import { DomainException } from '@gitspread/domain-primitives';

export class ContentNotFoundException extends DomainException {
  constructor() {
    super('Conteúdo não encontrado.');
  }
}
