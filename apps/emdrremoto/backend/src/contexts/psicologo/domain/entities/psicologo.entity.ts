import { AggregateRoot } from '@gitspread/domain-primitives';
import { PsicologoId } from '../value-objects/psicologo-id.vo';
import { Email } from '../value-objects/email.vo';
import { PsicologoRegisteredEvent } from '../events/psicologo-registered.event';

/**
 * O psicólogo — entidade autenticável (login por e-mail + senha). Só pode fazer login
 * após verificar o e-mail. Invariantes (nome/telefone) garantidas no construtor.
 */
export class Psicologo extends AggregateRoot {
  private constructor(
    private readonly _id: PsicologoId,
    private _email: Email,
    private _nome: string,
    private _telefone: string,
    private _passwordHash: string,
    private _emailVerificado: boolean,
    private _recoveryCode: string | null,
    private _active: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static register(email: Email, nome: string, telefone: string, passwordHash: string): Psicologo {
    const now = new Date();
    const psicologo = new Psicologo(
      PsicologoId.generate(),
      email,
      Psicologo.ensureNome(nome),
      Psicologo.ensureTelefone(telefone),
      passwordHash,
      false,
      null,
      true,
      now,
      now,
    );
    psicologo.addDomainEvent(
      new PsicologoRegisteredEvent(psicologo._id.value, email.value, psicologo._nome),
    );
    return psicologo;
  }

  // eslint-disable-next-line max-params
  static reconstitute(
    id: PsicologoId,
    email: Email,
    nome: string,
    telefone: string,
    passwordHash: string,
    emailVerificado: boolean,
    recoveryCode: string | null,
    active: boolean,
    createdAt: Date,
    updatedAt: Date,
  ): Psicologo {
    return new Psicologo(
      id,
      email,
      nome,
      telefone,
      passwordHash,
      emailVerificado,
      recoveryCode,
      active,
      createdAt,
      updatedAt,
    );
  }

  verifyEmail(): void {
    this._emailVerificado = true;
    this._updatedAt = new Date();
  }

  setRecoveryCode(code: string): void {
    this._recoveryCode = code;
    this._updatedAt = new Date();
  }

  clearRecoveryCode(): void {
    this._recoveryCode = null;
    this._updatedAt = new Date();
  }

  matchesRecoveryCode(code: string): boolean {
    return !!this._recoveryCode && this._recoveryCode === code;
  }

  changePassword(newPasswordHash: string): void {
    this._passwordHash = newPasswordHash;
    this._recoveryCode = null;
    this._updatedAt = new Date();
  }

  private static ensureNome(nome: string): string {
    const trimmed = (nome ?? '').trim();
    if (trimmed.length < 2 || trimmed.length > 150) {
      throw new Error('Nome do psicólogo deve ter entre 2 e 150 caracteres.');
    }
    return trimmed;
  }

  private static ensureTelefone(telefone: string): string {
    const trimmed = (telefone ?? '').trim();
    if (trimmed.length < 8 || trimmed.length > 30) {
      throw new Error('Telefone inválido.');
    }
    return trimmed;
  }

  get id(): PsicologoId {
    return this._id;
  }
  get email(): Email {
    return this._email;
  }
  get nome(): string {
    return this._nome;
  }
  get telefone(): string {
    return this._telefone;
  }
  get passwordHash(): string {
    return this._passwordHash;
  }
  get emailVerificado(): boolean {
    return this._emailVerificado;
  }
  get recoveryCode(): string | null {
    return this._recoveryCode;
  }
  get active(): boolean {
    return this._active;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}
