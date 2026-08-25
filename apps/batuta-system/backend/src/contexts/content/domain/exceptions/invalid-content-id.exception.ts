import { DomainException } from '@gitspread/domain-primitives';

export class InvalidContentIdException extends DomainException {
  constructor() {
    super('Identificador de conteúdo inválido.');
  }
}
