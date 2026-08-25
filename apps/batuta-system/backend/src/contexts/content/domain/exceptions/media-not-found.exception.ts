import { DomainException } from '@gitspread/domain-primitives';

export class MediaNotFoundException extends DomainException {
  constructor() {
    super('Mídia não encontrada.');
  }
}
