import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { FinancialAccountType } from '../financial-account-type';

/**
 * Conta financeira (§2.3 do 05) — caixa/banco/integração. Toda baixa de título aponta para uma
 * conta. `automatic` marca a conta alimentada por integração (COB/Open Finance futuros); a manual é
 * a que o operador movimenta. Tem ciclo de vida (rename/deactivate), nunca DELETE.
 *
 * `initialBalance` é o saldo de abertura; o saldo corrente é derivado dele + lançamentos (fatia de
 * cards). O valor é guardado em número e persistido com 2 casas.
 */
export class FinancialAccount extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _name: string,
    private readonly _type: FinancialAccountType,
    private _institution: string | null,
    private readonly _initialBalance: number,
    private readonly _automatic: boolean,
    private _active: boolean,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    name: string;
    type: FinancialAccountType;
    institution?: string | null;
    initialBalance?: number | null;
    automatic?: boolean;
  }): FinancialAccount {
    return new FinancialAccount(
      randomUUID(),
      params.accountId,
      params.name.trim(),
      params.type,
      params.institution?.trim() || null,
      Math.round(((params.initialBalance ?? 0) + Number.EPSILON) * 100) / 100,
      params.automatic ?? params.type === 'payment_integration',
      true,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    name: string;
    type: FinancialAccountType;
    institution: string | null;
    initialBalance: number;
    automatic: boolean;
    active: boolean;
    createdAt: Date;
  }): FinancialAccount {
    return new FinancialAccount(
      params.id,
      params.accountId,
      params.name,
      params.type,
      params.institution,
      params.initialBalance,
      params.automatic,
      params.active,
      params.createdAt,
    );
  }

  edit(params: { name?: string; institution?: string | null; active?: boolean }): void {
    if (params.name !== undefined) this._name = params.name.trim();
    if (params.institution !== undefined) this._institution = params.institution?.trim() || null;
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
  get type(): FinancialAccountType {
    return this._type;
  }
  get institution(): string | null {
    return this._institution;
  }
  get initialBalance(): number {
    return this._initialBalance;
  }
  get automatic(): boolean {
    return this._automatic;
  }
  get active(): boolean {
    return this._active;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
