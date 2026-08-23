import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';

/**
 * Rota (`route`, §2 do 04) — cadastro de região/circuito por onde o representante viaja
 * ("Rondonópolis", "Campo Grande 1001"). O revendedor é carteirizado por rota + representante
 * (a MESMA carteirização do ADR-0007, com dono = representante). Ciclo de vida: rename/deactivate,
 * nunca DELETE (uma rota já usada em viagem/carteira não some).
 */
export class Route extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _name: string,
    private _code: string | null,
    private _active: boolean,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: { accountId: string; name: string; code?: string | null }): Route {
    return new Route(
      randomUUID(),
      params.accountId,
      params.name.trim(),
      params.code?.trim() || null,
      true,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    name: string;
    code: string | null;
    active: boolean;
    createdAt: Date;
  }): Route {
    return new Route(
      params.id,
      params.accountId,
      params.name,
      params.code,
      params.active,
      params.createdAt,
    );
  }

  edit(params: { name?: string; code?: string | null; active?: boolean }): void {
    if (params.name !== undefined) this._name = params.name.trim();
    if (params.code !== undefined) this._code = params.code?.trim() || null;
    if (params.active !== undefined) this._active = params.active;
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get name(): string {
    return this._name;
  }
  get code(): string | null {
    return this._code;
  }
  get active(): boolean {
    return this._active;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
