import { DomainException } from '@gitspread/domain-primitives';

/**
 * The ONE exception every refusal of the reset flow raises — unknown e-mail, expired code, wrong
 * code, exhausted attempts, disabled user. Distinguishing them in the message would tell an
 * attacker which e-mails exist and whether a code is still alive.
 */
export class InvalidResetCodeException extends DomainException {
  constructor() {
    super('Código inválido ou expirado. Solicite um novo código.');
  }
}
