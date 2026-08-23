import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { PaymentConditionKind } from '../payment-condition-kind';

/**
 * Condição de pagamento NOMEADA (§4.2 do 02A) — cadastro do VND, reutilizável no pedido/pagamento.
 * Ex.: "À vista", "Cartão 3x", "Promissória 30/60/90". `name` é o rótulo que o operador escolhe;
 * `kind` é o tipo canônico (para o pagamento e, no futuro, para a Regra Comercial do ROT restringir).
 *
 * Tem ciclo de vida (rename/deactivate), nunca DELETE — uma condição já usada em pedido não some;
 * desativar tira do seletor sem apagar o histórico.
 */
export class PaymentCondition extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private _name: string,
    private _kind: PaymentConditionKind,
    private _active: boolean,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    name: string;
    kind: PaymentConditionKind;
  }): PaymentCondition {
    return new PaymentCondition(
      randomUUID(),
      params.accountId,
      params.name.trim(),
      params.kind,
      true,
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    name: string;
    kind: PaymentConditionKind;
    active: boolean;
    createdAt: Date;
  }): PaymentCondition {
    return new PaymentCondition(
      params.id,
      params.accountId,
      params.name,
      params.kind,
      params.active,
      params.createdAt,
    );
  }

  edit(params: { name?: string; kind?: PaymentConditionKind; active?: boolean }): void {
    if (params.name !== undefined) this._name = params.name.trim();
    if (params.kind !== undefined) this._kind = params.kind;
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
  get kind(): PaymentConditionKind {
    return this._kind;
  }
  get active(): boolean {
    return this._active;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
