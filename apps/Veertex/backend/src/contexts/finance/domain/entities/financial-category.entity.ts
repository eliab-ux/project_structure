import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { CategoryKind, CategoryOperation } from '../category-kind';

/**
 * Categoria financeira (§2.4 do 05) — árvore hierárquica de receitas × despesas por conta, com:
 *  - `parentId`: a hierarquia (raiz = `null`);
 *  - `dreLine`: mapeamento EXPLÍCITO para a linha de DRE (campo desde já; relatório na fase 2);
 *  - `defaultOperation`: quando preenchido, esta categoria é o padrão daquela operação
 *    (venda→faturamento, comissão→despesa comercial, etc.).
 *
 * Ciclo de vida (rename/reparent/deactivate), nunca DELETE.
 */
export class FinancialCategory extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _name: string,
    private readonly _kind: CategoryKind,
    private _parentId: string | null,
    private _dreLine: string | null,
    private _defaultOperation: CategoryOperation | null,
    private _active: boolean,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    name: string;
    kind: CategoryKind;
    parentId?: string | null;
    dreLine?: string | null;
    defaultOperation?: CategoryOperation | null;
    id?: string;
  }): FinancialCategory {
    return new FinancialCategory(
      params.id ?? randomUUID(),
      params.accountId,
      params.name.trim(),
      params.kind,
      params.parentId ?? null,
      params.dreLine?.trim() || null,
      params.defaultOperation ?? null,
      true,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    name: string;
    kind: CategoryKind;
    parentId: string | null;
    dreLine: string | null;
    defaultOperation: CategoryOperation | null;
    active: boolean;
    createdAt: Date;
  }): FinancialCategory {
    return new FinancialCategory(
      params.id,
      params.accountId,
      params.name,
      params.kind,
      params.parentId,
      params.dreLine,
      params.defaultOperation,
      params.active,
      params.createdAt,
    );
  }

  edit(params: {
    name?: string;
    parentId?: string | null;
    dreLine?: string | null;
    defaultOperation?: CategoryOperation | null;
    active?: boolean;
  }): void {
    if (params.name !== undefined) this._name = params.name.trim();
    if (params.parentId !== undefined) this._parentId = params.parentId;
    if (params.dreLine !== undefined) this._dreLine = params.dreLine?.trim() || null;
    if (params.defaultOperation !== undefined) this._defaultOperation = params.defaultOperation;
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
  get kind(): CategoryKind {
    return this._kind;
  }
  get parentId(): string | null {
    return this._parentId;
  }
  get dreLine(): string | null {
    return this._dreLine;
  }
  get defaultOperation(): CategoryOperation | null {
    return this._defaultOperation;
  }
  get active(): boolean {
    return this._active;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
