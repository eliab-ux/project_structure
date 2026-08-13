import { AggregateRoot } from '@veertex/domain-primitives';

/**
 * 15 minutes, and NOT an environment variable.
 *
 * The channel is instantaneous — the user reads the WhatsApp message in seconds — so a longer life
 * only widens the window for whoever intercepted the phone. It is a business rule, not a knob.
 */
export const RESET_CODE_TTL_MINUTES = 15;

/**
 * Five guesses per code. Turns 1,000,000 combinations into five chances, which is what makes a
 * six-digit secret defensible at all.
 */
export const MAX_RESET_CODE_ATTEMPTS = 5;

/**
 * A single password-recovery code.
 *
 * Only the bcrypt HASH of the code is ever stored: neither a database dump nor a log line reveals
 * the value. The plaintext exists in exactly two places — the function that generated it, and the
 * WhatsApp message the user received.
 */
export class PasswordResetCode extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _userId: string,
    private readonly _codeHash: string,
    private readonly _expiresAt: Date,
    private _attempts: number,
    private _consumedAt: Date | null,
    private _sentAt: Date | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static issue(params: {
    id: string;
    accountId: string;
    userId: string;
    codeHash: string;
    now: Date;
  }): PasswordResetCode {
    return new PasswordResetCode(
      params.id,
      params.accountId,
      params.userId,
      params.codeHash,
      new Date(params.now.getTime() + RESET_CODE_TTL_MINUTES * 60_000),
      0,
      null,
      null,
      params.now,
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    userId: string;
    codeHash: string;
    expiresAt: Date;
    attempts: number;
    consumedAt: Date | null;
    sentAt: Date | null;
    createdAt: Date;
  }): PasswordResetCode {
    return new PasswordResetCode(
      params.id,
      params.accountId,
      params.userId,
      params.codeHash,
      params.expiresAt,
      params.attempts,
      params.consumedAt,
      params.sentAt,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get userId(): string {
    return this._userId;
  }

  /** Read only by the use case, to compare against the code the user typed. */
  get codeHash(): string {
    return this._codeHash;
  }

  get expiresAt(): Date {
    return this._expiresAt;
  }

  get attempts(): number {
    return this._attempts;
  }

  get consumedAt(): Date | null {
    return this._consumedAt;
  }

  get sentAt(): Date | null {
    return this._sentAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  isUsable(now: Date): boolean {
    return (
      this._consumedAt === null && this._expiresAt > now && this._attempts < MAX_RESET_CODE_ATTEMPTS
    );
  }

  /**
   * Alinha o contador em memória ao valor que o BANCO acabou de gravar.
   *
   * A contagem de tentativas é feita por `UPDATE ... attempts = attempts + 1` numa transação
   * PRÓPRIA (ver `PasswordResetCodeRepositoryPort.registerFailedAttempt`), e não por incremento
   * aqui seguido de `save`. Duas razões, ambas descobertas na prática:
   *
   *  1. **Rollback.** Toda requisição roda dentro de uma transação, e uma tentativa errada termina
   *     em exceção — que derruba a transação inteira e leva junto o `update` do contador. O limite
   *     de cinco existia no código e valia zero no banco: `attempts` ficava em 0 para sempre, e o
   *     código de seis dígitos ficava exposto a força bruta pelos 15 minutos de validade.
   *  2. **Concorrência.** Ler, somar 1 e gravar faz duas tentativas simultâneas lerem 0 e gravarem
   *     1 — duas chances pelo preço de uma. `attempts + 1` no SQL não tem esse buraco.
   *
   * Este método existe para que a entidade em memória não fique desatualizada e um `save` posterior
   * (o do caminho de sucesso) não regrave o valor antigo por cima do que o banco tem.
   */
  syncAttempts(attempts: number): void {
    this._attempts = attempts;
  }

  consume(now: Date): void {
    this._consumedAt = now;
  }

  /** Written only after the WhatsApp send actually succeeded — see RequestPasswordResetUseCase. */
  markSent(now: Date): void {
    this._sentAt = now;
  }

  /** Invalidates a still-live code, so only one is ever usable per user. */
  invalidate(now: Date): void {
    this._consumedAt ??= now;
  }
}
