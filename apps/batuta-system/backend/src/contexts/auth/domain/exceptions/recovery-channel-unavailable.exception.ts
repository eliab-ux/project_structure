import { DomainException } from '@gitspread/domain-primitives';

/**
 * The recovery channel itself is not usable — the platform's Evolution instance is not configured.
 *
 * Deliberately raised BEFORE the user is looked up. If it were raised at send time, a real e-mail
 * would fail while an unknown e-mail answered 204, and the difference would tell an attacker which
 * accounts exist. The message says nothing about which variable is missing; that goes to the log.
 */
export class RecoveryChannelUnavailableException extends DomainException {
  constructor() {
    super('Recuperação de senha indisponível no momento. Procure o administrador da conta.');
  }
}
