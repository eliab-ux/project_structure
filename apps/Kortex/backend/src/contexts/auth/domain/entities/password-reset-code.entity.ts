import { randomInt } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { AccountId } from '../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../user/domain/value-objects/user-id.vo';
import { PasswordResetCodeId } from '../value-objects/password-reset-code-id.vo';

/**
 * Código de 6 dígitos da recuperação de senha por WhatsApp (CLAUDE.md).
 *
 * Cada número aqui é uma regra, não uma preferência:
 *
 * - **15 minutos** de validade. O canal é instantâneo; um código que vale uma hora só amplia a
 *   janela de quem o interceptou.
 * - **5 tentativas**, contadas ANTES de recusar. Transforma 1.000.000 de combinações em 5
 *   chances. Contar depois deixaria a última tentativa de graça.
 * - **Uso único**, e **um só código vivo por usuário**: dois códigos válidos dobram a superfície
 *   de adivinhação.
 *
 * A entidade nunca guarda o código em claro. Ela o gera, devolve uma vez para quem vai enviar, e
 * persiste só o hash — nem dump de banco nem log revelam o valor.
 */
export class PasswordResetCode extends AggregateRoot {
  static readonly TTL_MINUTES = 15;
  static readonly MAX_ATTEMPTS = 5;
  static readonly DIGITS = 6;

  private constructor(
    private readonly _id: PasswordResetCodeId,
    private readonly _accountId: AccountId,
    private readonly _userId: UserId,
    private readonly _codeHash: string,
    private readonly _expiresAt: Date,
    private _usedAt: Date | null,
    private _sentAt: Date | null,
    private _attempts: number,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  /**
   * Sorteia um código novo. `randomInt` do `node:crypto`, nunca `Math.random()`: o gerador padrão
   * do V8 é previsível a partir de saídas observadas e não serve para gerar segredo.
   */
  static generatePlainCode(): string {
    const max = 10 ** PasswordResetCode.DIGITS;
    return String(randomInt(0, max)).padStart(PasswordResetCode.DIGITS, '0');
  }

  static issue(input: {
    accountId: AccountId;
    userId: UserId;
    codeHash: string;
    now?: Date;
  }): PasswordResetCode {
    const now = input.now ?? new Date();
    const expiresAt = new Date(now.getTime() + PasswordResetCode.TTL_MINUTES * 60_000);

    return new PasswordResetCode(
      PasswordResetCodeId.create(),
      input.accountId,
      input.userId,
      input.codeHash,
      expiresAt,
      null,
      null,
      0,
      now,
    );
  }

  static restore(input: {
    id: PasswordResetCodeId;
    accountId: AccountId;
    userId: UserId;
    codeHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    sentAt: Date | null;
    attempts: number;
    createdAt: Date;
  }): PasswordResetCode {
    return new PasswordResetCode(
      input.id,
      input.accountId,
      input.userId,
      input.codeHash,
      input.expiresAt,
      input.usedAt,
      input.sentAt,
      input.attempts,
      input.createdAt,
    );
  }

  /**
   * Marca o envio. É este carimbo, e não a criação, que alimenta o limite por hora — o limite
   * conta ENVIOS. Se contasse tentativas de criação, uma indisponibilidade do WhatsApp consumiria
   * a cota do usuário sem que uma única mensagem tivesse chegado.
   */
  markSent(at: Date = new Date()): void {
    this._sentAt = at;
  }

  /** Invalida sem ter sido usado — é o que acontece com o código anterior quando se pede um novo. */
  invalidate(at: Date = new Date()): void {
    this._usedAt = at;
  }

  registerAttempt(): void {
    this._attempts += 1;
  }

  markUsed(at: Date = new Date()): void {
    this._usedAt = at;
  }

  isUsable(now: Date = new Date()): boolean {
    return (
      this._usedAt === null &&
      this._expiresAt.getTime() > now.getTime() &&
      this._attempts < PasswordResetCode.MAX_ATTEMPTS
    );
  }

  get id(): PasswordResetCodeId {
    return this._id;
  }

  get accountId(): AccountId {
    return this._accountId;
  }

  get userId(): UserId {
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
