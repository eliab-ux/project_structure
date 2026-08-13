import { DomainException } from '@veertex/domain-primitives';

/**
 * The account exists but cannot be used: suspended for non-payment, or cancelled.
 *
 * One exception for both states, with a message that does not distinguish them, because the person
 * hitting it is a user of the account and the remedy is the same conversation with whoever
 * administers it. The internal reason is in the log and in `suspension_reason`.
 */
export class AccountUnavailableException extends DomainException {
  constructor() {
    super('Esta conta está indisponível. Fale com o administrador da sua empresa.');
  }
}
