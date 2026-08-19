import { AggregateRoot } from '@gitspread/domain-primitives';

/**
 * A ativação de um módulo por uma conta.
 *
 * Uma linha por (conta, módulo), com histórico de quando ligou e desligou. Desativar **nunca**
 * apaga a linha nem qualquer dado do módulo — 01_Veertex_Core §3.7: "desativar preserva dados".
 * Reativar devolve exatamente o que estava lá, o que só é verdade porque nada foi removido.
 */
export class AccountModule extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _moduleCode: string,
    private _active: boolean,
    private _activatedAt: Date | null,
    private _deactivatedAt: Date | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static activate(params: {
    id: string;
    accountId: string;
    moduleCode: string;
    now?: Date;
  }): AccountModule {
    const now = params.now ?? new Date();
    return new AccountModule(params.id, params.accountId, params.moduleCode, true, now, null, now);
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    moduleCode: string;
    active: boolean;
    activatedAt: Date | null;
    deactivatedAt: Date | null;
    createdAt: Date;
  }): AccountModule {
    return new AccountModule(
      params.id,
      params.accountId,
      params.moduleCode,
      params.active,
      params.activatedAt,
      params.deactivatedAt,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get moduleCode(): string {
    return this._moduleCode;
  }

  get active(): boolean {
    return this._active;
  }

  get activatedAt(): Date | null {
    return this._activatedAt;
  }

  get deactivatedAt(): Date | null {
    return this._deactivatedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  turnOn(now: Date = new Date()): void {
    this._active = true;
    this._activatedAt = now;
    this._deactivatedAt = null;
  }

  turnOff(now: Date = new Date()): void {
    this._active = false;
    this._deactivatedAt = now;
  }
}
