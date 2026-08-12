import { PasswordResetCode } from '../../../domain/entities/password-reset-code.entity';

export const PASSWORD_RESET_CODE_REPOSITORY = Symbol('PASSWORD_RESET_CODE_REPOSITORY');

export interface PasswordResetCodeRepositoryPort {
  /** The live code of a user, if any. Scoped — the caller has already established the tenant. */
  findLiveByUser(userId: string, now: Date): Promise<PasswordResetCode | null>;

  /**
   * How many codes were actually SENT to this user since `since`.
   *
   * Counts sends, not requests: a failure of the WhatsApp gateway must not consume the user's
   * hourly quota, or an outage would lock them out of recovery entirely.
   */
  countSentSince(userId: string, since: Date): Promise<number>;

  /** Invalidates every live code of the user — only one may be usable at a time. */
  invalidateAllForUser(userId: string, now: Date): Promise<void>;

  /**
   * Conta uma tentativa errada de forma que ela SOBREVIVA ao rollback da requisição, e devolve o
   * total já gravado.
   *
   * Está no port, e não escondido na implementação, porque é uma exigência de comportamento e não
   * um detalhe de persistência: quem lê a interface precisa saber que esta escrita é independente
   * da transação em curso. Uma tentativa errada termina em exceção, a exceção derruba a transação
   * da requisição, e um contador gravado dentro dela seria desfeito — que foi exatamente o que
   * acontecia. O limite de cinco tentativas existia no código e não existia no banco.
   */
  registerFailedAttempt(codeId: string): Promise<number>;

  save(code: PasswordResetCode): Promise<PasswordResetCode>;
}
