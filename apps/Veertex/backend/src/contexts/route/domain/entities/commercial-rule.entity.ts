import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';

/**
 * Regra Comercial do representante (§3.7 do 04) — perfil que RESTRINGE o que o app oferece em campo:
 * empresas, naturezas de operação, condições de pagamento e tabelas de preço permitidas (checkboxes).
 * Ex. real: "Juliano tudo, menos boleto".
 *
 * Uma por representante (`userId`). Listas vazias = SEM restrição naquela dimensão (o perfil não
 * limita o que não lista) — a restrição é opt-in por dimensão. A checagem de autorização em campo
 * (fatia do app / abertura de pedido de rota) consulta este perfil; aqui é só o cadastro.
 */
export class CommercialRule extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _userId: string,
    private _allowedCompanyIds: string[],
    private _allowedPaymentConditionIds: string[],
    private _allowedPriceListIds: string[],
    private _allowedOperationNatures: string[],
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    userId: string;
    allowedCompanyIds?: string[];
    allowedPaymentConditionIds?: string[];
    allowedPriceListIds?: string[];
    allowedOperationNatures?: string[];
  }): CommercialRule {
    return new CommercialRule(
      randomUUID(),
      params.accountId,
      params.userId,
      params.allowedCompanyIds ?? [],
      params.allowedPaymentConditionIds ?? [],
      params.allowedPriceListIds ?? [],
      params.allowedOperationNatures ?? [],
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    userId: string;
    allowedCompanyIds: string[];
    allowedPaymentConditionIds: string[];
    allowedPriceListIds: string[];
    allowedOperationNatures: string[];
    createdAt: Date;
  }): CommercialRule {
    return new CommercialRule(
      params.id,
      params.accountId,
      params.userId,
      params.allowedCompanyIds,
      params.allowedPaymentConditionIds,
      params.allowedPriceListIds,
      params.allowedOperationNatures,
      params.createdAt,
    );
  }

  replace(params: {
    allowedCompanyIds?: string[];
    allowedPaymentConditionIds?: string[];
    allowedPriceListIds?: string[];
    allowedOperationNatures?: string[];
  }): void {
    if (params.allowedCompanyIds !== undefined) this._allowedCompanyIds = params.allowedCompanyIds;
    if (params.allowedPaymentConditionIds !== undefined) {
      this._allowedPaymentConditionIds = params.allowedPaymentConditionIds;
    }
    if (params.allowedPriceListIds !== undefined) {
      this._allowedPriceListIds = params.allowedPriceListIds;
    }
    if (params.allowedOperationNatures !== undefined) {
      this._allowedOperationNatures = params.allowedOperationNatures;
    }
  }

  /** Uma condição de pagamento é permitida se a lista está vazia (sem restrição) ou a contém. */
  allowsPaymentCondition(paymentConditionId: string): boolean {
    return (
      this._allowedPaymentConditionIds.length === 0 ||
      this._allowedPaymentConditionIds.includes(paymentConditionId)
    );
  }

  allowsCompany(companyId: string): boolean {
    return this._allowedCompanyIds.length === 0 || this._allowedCompanyIds.includes(companyId);
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get userId(): string {
    return this._userId;
  }
  get allowedCompanyIds(): readonly string[] {
    return this._allowedCompanyIds;
  }
  get allowedPaymentConditionIds(): readonly string[] {
    return this._allowedPaymentConditionIds;
  }
  get allowedPriceListIds(): readonly string[] {
    return this._allowedPriceListIds;
  }
  get allowedOperationNatures(): readonly string[] {
    return this._allowedOperationNatures;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
