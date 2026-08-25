import { AggregateRoot } from '@gitspread/domain-primitives';
import { randomBytes } from 'crypto';
import { SessionId } from '../value-objects/session-id.vo';
import { SessionCreatedEvent } from '../events/session-created.event';

export type SessionRole = 'psicologo' | 'paciente';

/**
 * A sessão EMDR entre um psicólogo e um paciente. Aggregate root da experiência em tempo
 * real: guarda o `sessionCode` (usado como room do Socket.IO) e os marcos de entrada/saída.
 * NÃO guarda socket ids — o roteamento em tempo real é por rooms.
 */
export class Session extends AggregateRoot {
  private constructor(
    private readonly _id: SessionId,
    private _sessionCode: string,
    private _dailyCoName: string | null,
    private readonly _psicologoId: string,
    private readonly _pacienteId: string,
    private _pacienteIn: Date | null,
    private _psicologoIn: Date | null,
    private _sessionOut: Date | null,
    private _active: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(params: {
    psicologoId: string;
    pacienteId: string;
    dailyCoName?: string | null;
  }): Session {
    const now = new Date();
    const session = new Session(
      SessionId.generate(),
      Session.generateCode(),
      params.dailyCoName ?? null,
      params.psicologoId,
      params.pacienteId,
      null,
      null,
      null,
      true,
      now,
      now,
    );
    session.addDomainEvent(
      new SessionCreatedEvent(
        session._id.value,
        session._sessionCode,
        params.psicologoId,
        params.pacienteId,
      ),
    );
    return session;
  }

  // eslint-disable-next-line max-params
  static reconstitute(
    id: SessionId,
    sessionCode: string,
    dailyCoName: string | null,
    psicologoId: string,
    pacienteId: string,
    pacienteIn: Date | null,
    psicologoIn: Date | null,
    sessionOut: Date | null,
    active: boolean,
    createdAt: Date,
    updatedAt: Date,
  ): Session {
    return new Session(
      id,
      sessionCode,
      dailyCoName,
      psicologoId,
      pacienteId,
      pacienteIn,
      psicologoIn,
      sessionOut,
      active,
      createdAt,
      updatedAt,
    );
  }

  /** Confirma se o usuário autenticado pertence a esta sessão (menor privilégio). */
  isMember(userId: string, role: SessionRole): boolean {
    if (role === 'psicologo') {
      return this._psicologoId === userId;
    }
    return this._pacienteId === userId;
  }

  registerEntry(role: SessionRole): void {
    const now = new Date();
    if (role === 'psicologo') {
      this._psicologoIn = now;
    } else {
      this._pacienteIn = now;
    }
    this._updatedAt = now;
  }

  end(): void {
    this._sessionOut = new Date();
    this._active = false;
    this._updatedAt = new Date();
  }

  attachRoom(dailyCoName: string): void {
    this._dailyCoName = dailyCoName;
    this._updatedAt = new Date();
  }

  private static generateCode(): string {
    return randomBytes(6).toString('hex');
  }

  get id(): SessionId {
    return this._id;
  }
  get sessionCode(): string {
    return this._sessionCode;
  }
  get dailyCoName(): string | null {
    return this._dailyCoName;
  }
  get psicologoId(): string {
    return this._psicologoId;
  }
  get pacienteId(): string {
    return this._pacienteId;
  }
  get pacienteIn(): Date | null {
    return this._pacienteIn;
  }
  get psicologoIn(): Date | null {
    return this._psicologoIn;
  }
  get sessionOut(): Date | null {
    return this._sessionOut;
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
