import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { MovementForBalance } from '../stock-balance';
import { STOCK_MOVEMENT_TYPE, StockMovementType } from '../movement-type';

/**
 * Um movimento de estoque — **append-only** (§2.7 do 03). Nunca é alterado nem apagado; estorno é um
 * movimento novo. Por isso a entidade não tem métodos de mudança de estado: nasce e é gravada.
 *
 * O `unitCost` já vem RESOLVIDO pelo `RegisterMovement` (a venda estampa o custo médio da época; a
 * devolução de cliente, o custo da época do movimento original). `relatedMovementId` liga a devolução
 * ao seu movimento de origem. `usedFallback` registra quando a devolução não achou a origem e reentrou
 * pela média vigente (§3.4) — a exceção fica VISÍVEL, não silenciosa.
 */
export class StockMovement extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _companyId: string,
    private readonly _productId: string,
    private readonly _locationId: string,
    private readonly _type: StockMovementType,
    /** Magnitude (>0) para in/out; com sinal para `inventory_adjust`. */
    private readonly _signedQuantity: number,
    private readonly _unitCost: number | null,
    private readonly _relatedMovementId: string | null,
    private readonly _usedFallback: boolean,
    private readonly _note: string | null,
    private readonly _occurredAt: Date,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    companyId: string;
    productId: string;
    locationId: string;
    type: StockMovementType;
    signedQuantity: number;
    unitCost: number | null;
    relatedMovementId?: string | null;
    usedFallback?: boolean;
    note?: string | null;
    occurredAt?: Date | null;
  }): StockMovement {
    return new StockMovement(
      randomUUID(),
      params.accountId,
      params.companyId,
      params.productId,
      params.locationId,
      params.type,
      params.signedQuantity,
      params.unitCost,
      params.relatedMovementId ?? null,
      params.usedFallback ?? false,
      params.note?.trim() || null,
      params.occurredAt ?? new Date(),
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    companyId: string;
    productId: string;
    locationId: string;
    type: StockMovementType;
    signedQuantity: number;
    unitCost: number | null;
    relatedMovementId: string | null;
    usedFallback: boolean;
    note: string | null;
    occurredAt: Date;
    createdAt: Date;
  }): StockMovement {
    return new StockMovement(
      params.id,
      params.accountId,
      params.companyId,
      params.productId,
      params.locationId,
      params.type,
      params.signedQuantity,
      params.unitCost,
      params.relatedMovementId,
      params.usedFallback,
      params.note,
      params.occurredAt,
      params.createdAt,
    );
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
  get productId(): string {
    return this._productId;
  }
  get locationId(): string {
    return this._locationId;
  }
  get type(): StockMovementType {
    return this._type;
  }
  get direction(): 'in' | 'out' | 'adjust' {
    return STOCK_MOVEMENT_TYPE[this._type].direction;
  }
  get signedQuantity(): number {
    return this._signedQuantity;
  }
  get unitCost(): number | null {
    return this._unitCost;
  }
  get relatedMovementId(): string | null {
    return this._relatedMovementId;
  }
  get usedFallback(): boolean {
    return this._usedFallback;
  }
  get note(): string | null {
    return this._note;
  }
  get occurredAt(): Date {
    return this._occurredAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }

  toBalanceInput(): MovementForBalance {
    return {
      direction: this.direction,
      signedQuantity: this._signedQuantity,
      unitCost: this._unitCost,
    };
  }
}
