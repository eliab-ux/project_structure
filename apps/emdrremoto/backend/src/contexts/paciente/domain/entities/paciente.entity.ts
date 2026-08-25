import { AggregateRoot } from '@gitspread/domain-primitives';
import { randomBytes } from 'crypto';
import { PacienteId } from '../value-objects/paciente-id.vo';
import { PacienteCreatedEvent } from '../events/paciente-created.event';

/**
 * O paciente é criado e pertence a um psicólogo. O acesso do paciente à sessão é feito
 * por um `hash` de convite (credencial) — sem senha. Trocar o hash revoga o acesso antigo.
 */
export class Paciente extends AggregateRoot {
  private constructor(
    private readonly _id: PacienteId,
    private _psicologoId: string,
    private _email: string,
    private _nome: string,
    private _telefone: string,
    private _pais: string | null,
    private _hash: string,
    private _active: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(params: {
    psicologoId: string;
    email: string;
    nome: string;
    telefone: string;
    pais?: string | null;
  }): Paciente {
    const now = new Date();
    const paciente = new Paciente(
      PacienteId.generate(),
      params.psicologoId,
      Paciente.ensureEmail(params.email),
      Paciente.ensureNome(params.nome),
      Paciente.ensureTelefone(params.telefone),
      params.pais?.trim() || null,
      Paciente.generateHash(),
      true,
      now,
      now,
    );
    paciente.addDomainEvent(
      new PacienteCreatedEvent(paciente._id.value, params.psicologoId, paciente._email),
    );
    return paciente;
  }

  // eslint-disable-next-line max-params
  static reconstitute(
    id: PacienteId,
    psicologoId: string,
    email: string,
    nome: string,
    telefone: string,
    pais: string | null,
    hash: string,
    active: boolean,
    createdAt: Date,
    updatedAt: Date,
  ): Paciente {
    return new Paciente(
      id,
      psicologoId,
      email,
      nome,
      telefone,
      pais,
      hash,
      active,
      createdAt,
      updatedAt,
    );
  }

  regenerateHash(): void {
    this._hash = Paciente.generateHash();
    this._updatedAt = new Date();
  }

  updateDetails(params: {
    email: string;
    nome: string;
    telefone: string;
    pais?: string | null;
  }): void {
    this._email = Paciente.ensureEmail(params.email);
    this._nome = Paciente.ensureNome(params.nome);
    this._telefone = Paciente.ensureTelefone(params.telefone);
    this._pais = params.pais?.trim() || null;
    this._updatedAt = new Date();
  }

  private static generateHash(): string {
    return randomBytes(16).toString('hex');
  }

  private static ensureEmail(email: string): string {
    const normalized = (email ?? '').toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 255) {
      throw new Error(`E-mail inválido: ${email}`);
    }
    return normalized;
  }

  private static ensureNome(nome: string): string {
    const trimmed = (nome ?? '').trim();
    if (trimmed.length < 2 || trimmed.length > 150) {
      throw new Error('Nome do paciente deve ter entre 2 e 150 caracteres.');
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

  get id(): PacienteId {
    return this._id;
  }
  get psicologoId(): string {
    return this._psicologoId;
  }
  get email(): string {
    return this._email;
  }
  get nome(): string {
    return this._nome;
  }
  get telefone(): string {
    return this._telefone;
  }
  get pais(): string | null {
    return this._pais;
  }
  get hash(): string {
    return this._hash;
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
