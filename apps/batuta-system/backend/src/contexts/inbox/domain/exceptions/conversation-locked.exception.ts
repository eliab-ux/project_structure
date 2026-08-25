import { DomainException } from '@gitspread/domain-primitives';

/**
 * Another operator has this conversation open (§10.3 item 1).
 *
 * The message names nobody: an operator id means nothing to whoever reads it, and the useful part is
 * that the item is taken and will free itself. The holder is in the log.
 */
export class ConversationLockedException extends DomainException {
  constructor(public readonly lockedBy: string) {
    super('Outro operador está atendendo este contato agora. Tente novamente em alguns minutos.');
  }
}
