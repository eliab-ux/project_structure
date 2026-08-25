import { DomainException } from '@gitspread/domain-primitives';

export class OwnMediaNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(`Mídia não encontrada: ${identifier}`);
  }
}
