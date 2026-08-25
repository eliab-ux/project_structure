import { DomainException } from '@gitspread/domain-primitives';

export class InvalidYoutubeVideoIdException extends DomainException {
  constructor() {
    super('Identificador de vídeo do YouTube inválido');
  }
}
