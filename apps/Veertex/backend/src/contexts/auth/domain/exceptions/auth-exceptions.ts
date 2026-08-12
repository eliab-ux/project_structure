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

/**
 * Teto de falhas de login por IP atingido — a única recusa DURA do desenho de proteção do login.
 *
 * Dura por IP, e não por conta, e a diferença é o que separa proteção de negação de serviço:
 * bloquear uma conta permite que qualquer um tranque um operador sabendo só o e-mail dele, e num ERP
 * com PDV isso é caixa parado no expediente. Por origem, quem paga o preço é quem está varrendo.
 *
 * Não é oráculo de enumeração: a recusa depende de quantas falhas vieram DAQUELE IP, não de qual
 * e-mail foi tentado nem de ele existir. Duas tentativas do mesmo IP, uma com e-mail real e outra
 * com e-mail inventado, recebem a mesma resposta no mesmo ponto da contagem.
 *
 * O nome começa com "TooMany" de propósito: o `GlobalExceptionFilter` deriva o status HTTP do nome da
 * classe (`*NotFound* → 404`, `*InvalidCredentials* → 401`, `*TooMany* → 429`), que é como o domínio
 * se mantém sem conceito de HTTP dentro.
 */
export class TooManyLoginAttemptsException extends DomainException {
  constructor() {
    super('Muitas tentativas de login desta origem. Aguarde alguns minutos e tente novamente.');
  }
}
