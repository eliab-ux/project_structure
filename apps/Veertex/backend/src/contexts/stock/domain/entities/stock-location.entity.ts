import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';

/**
 * Tipo da localização (§2 do 03A). `warehouse` (depósito da empresa) e `rep_load` (carga do
 * representante/viagem — gerida pelo ROT) hoje; `pdv` reservado para o futuro. O TIPO nasce agora
 * para o enum não mudar quando o ROT chegar.
 */
export type StockLocationKind = 'warehouse' | 'rep_load' | 'pdv';

export const STOCK_LOCATION_KINDS: readonly StockLocationKind[] = ['warehouse', 'rep_load', 'pdv'];

/**
 * Os tipos que o cadastro MANUAL cria hoje. `rep_load` nasce pelo ROT (carga de viagem), `pdv` está
 * reservado — nenhum dos dois é criado à mão até o módulo dono existir.
 */
export const CREATABLE_LOCATION_KINDS: readonly StockLocationKind[] = ['warehouse'];

/** Nome da localização default que toda empresa recebe no onboarding (§2 do 03A). */
export const DEFAULT_WAREHOUSE_NAME = 'Depósito principal';

/**
 * Localização de estoque, POR empresa (§2 do 03A). O saldo passa a ter dimensão de localização —
 * pré-requisito do ROT (consignação = carga que sai do depósito e vive "na mão do representante").
 * Toda empresa nasce com uma `warehouse` default.
 */
export class StockLocation extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _companyId: string,
    private readonly _kind: StockLocationKind,
    private _name: string,
    private _active: boolean,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    companyId: string;
    kind: StockLocationKind;
    name: string;
  }): StockLocation {
    return new StockLocation(
      randomUUID(),
      params.accountId,
      params.companyId,
      params.kind,
      params.name.trim(),
      true,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    companyId: string;
    kind: StockLocationKind;
    name: string;
    active: boolean;
    createdAt: Date;
  }): StockLocation {
    return new StockLocation(
      params.id,
      params.accountId,
      params.companyId,
      params.kind,
      params.name,
      params.active,
      params.createdAt,
    );
  }

  rename(name: string): void {
    this._name = name.trim();
  }
  deactivate(): void {
    this._active = false;
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get companyId(): string {
    return this._companyId;
  }
  get kind(): StockLocationKind {
    return this._kind;
  }
  get name(): string {
    return this._name;
  }
  get active(): boolean {
    return this._active;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
