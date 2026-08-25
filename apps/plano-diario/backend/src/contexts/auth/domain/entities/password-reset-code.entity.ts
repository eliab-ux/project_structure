import { AggregateRoot } from '@gitspread/domain-primitives';
import { randomUUID } from 'node:crypto';

/** Tempo de vida do código. Curto porque o canal (WhatsApp) é instantâneo. */
export const RESET_CODE_TTL_MINUTES = 15;

/**
 * Quantos palpites errados o código aceita antes de morrer. Com 6 dígitos são 1.000.000 de
 * combinações; 5 tentativas deixam a chance de acerto por força bruta em 0,0005%.
 */
export const RESET_CODE_MAX_ATTEMPTS = 5;

/**
 * O código de uso único que autoriza a troca de senha.
 *
 * O código **em claro nunca é guardado**: a entidade só conhece o hash. Quem sabe o número é o
 * dono do WhatsApp que o recebeu — nem um dump do banco nem um log revelam o valor.
 */
export class PasswordResetCode extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _userId: string,
    private readonly _codeHash: string,
    private readonly _expiresAt: Date,
    private _usedAt: Date | null,
    private _sentAt: Date | null,
    private _attempts: number,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static issue(params: { userId: string; codeHash: string; now?: Date }): PasswordResetCode {
    const now = params.now ?? new Date();
    return new PasswordResetCode(
      randomUUID(),
      params.userId,
      params.codeHash,
      new Date(now.getTime() + RESET_CODE_TTL_MINUTES * 60_000),
      null,
      null,
      0,
      now,
    );
  }

  static reconstitute(params: {
    id: string;
    userId: string;
    codeHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    sentAt: Date | null;
    attempts: number;
    createdAt: Date;
  }): PasswordResetCode {
    return new PasswordResetCode(
      params.id,
      params.userId,
      params.codeHash,
      params.expiresAt,
      params.usedAt,
      params.sentAt,
      params.attempts,
      params.createdAt,
    );
  }

  /**
   * Marca que a mensagem saiu de fato.
   *
   * Separado da criação porque o limite de solicitações por hora conta ENVIOS, não tentativas:
   * o limite existe para o WhatsApp do usuário não virar canal de spam, e mensagem que não saiu
   * não spammou ninguém. Contar tentativa fazia uma falha de infraestrutura consumir a cota do
   * usuário — foi exatamente o que aconteceu quando o canal estava sem configuração.
   */
  markSent(now: Date = new Date()): void {
    this._sentAt = now;
  }

  /** Ainda pode ser usado: não expirou, não foi usado e não esgotou as tentativas. */
  isUsable(now: Date = new Date()): boolean {
    return !this.isExpired(now) && this._usedAt === null && this.hasAttemptsLeft;
  }

  isExpired(now: Date = new Date()): boolean {
    return now.getTime() >= this._expiresAt.getTime();
  }

  get hasAttemptsLeft(): boolean {
    return this._attempts < RESET_CODE_MAX_ATTEMPTS;
  }

  /** Registra um palpite errado. Contar SEMPRE, mesmo em erro, é o que limita a força bruta. */
  registerFailedAttempt(): void {
    this._attempts += 1;
  }

  markUsed(now: Date = new Date()): void {
    this._usedAt = now;
  }

  get id(): string {
    return this._id;
  }
  get userId(): string {
    return this._userId;
  }
  get codeHash(): string {
    return this._codeHash;
  }
  get expiresAt(): Date {
    return this._expiresAt;
  }
  get usedAt(): Date | null {
    return this._usedAt;
  }
  /** `null` = a mensagem nunca chegou a sair. Não conta para o limite por hora. */
  get sentAt(): Date | null {
    return this._sentAt;
  }
  get attempts(): number {
    return this._attempts;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
