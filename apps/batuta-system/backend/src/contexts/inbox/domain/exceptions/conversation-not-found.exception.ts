import { DomainException } from '@gitspread/domain-primitives';

export class ConversationNotFoundException extends DomainException {
  constructor() {
    super('Conversa não encontrada.');
  }
}
