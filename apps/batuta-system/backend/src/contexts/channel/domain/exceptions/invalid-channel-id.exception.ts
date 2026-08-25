import { DomainException } from '@gitspread/domain-primitives';

export class InvalidChannelIdException extends DomainException {
  constructor() {
    super('Identificador de canal inválido.');
  }
}
