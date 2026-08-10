import { DomainException } from '@gitspread/domain-primitives';

/**
 * ONE exception for every way a reset code can fail: wrong, expired, already used, too many
 * attempts, or no code at all for that e-mail.
 *
 * They must be indistinguishable. If "código expirado" and "código inválido" read differently, an
 * attacker learns that a code exists for that address — which tells them the account exists.
 */
export class InvalidResetCodeException extends DomainException {
  constructor() {
    super('Código inválido ou expirado. Solicite um novo código.');
  }
}

/**
 * The recovery channel itself is unusable — the Evolution system instance is not configured or is
 * down. Surfaced to the caller (unlike every other failure in that flow) and checked BEFORE the
 * user is looked up: if it were checked afterwards, a registered e-mail would error while an
 * unknown one answered 204, handing over the list of accounts that exist.
 */
export class RecoveryChannelUnavailableException extends DomainException {
  constructor() {
    super('Não foi possível enviar o código agora. Tente novamente em alguns minutos.');
  }
}
