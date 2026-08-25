import { DomainException } from '@gitspread/domain-primitives';

export class QuickReplyNotFoundException extends DomainException {
  constructor() {
    super('Resposta rápida não encontrada.');
  }
}
