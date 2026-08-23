import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { OrderPaymentMethod } from '../order-payment-method';
import { InvalidPaymentAmountException } from '../exceptions/order-exceptions';

/**
 * Um pagamento de pedido (§4.1 do 02A). N por pedido → **pagamento misto** (dinheiro + cartão na
 * mesma venda). Carrega forma, valor, parcelas e o **bloco TEF-ready** (provedor, NSU, autorização,
 * bandeira, status, payload, `acquirerCnpj`).
 *
 * ## Dormente até o PDV/TEF (fronteira declarada)
 * O schema **nasce pronto** (a IN 1608/25-GO exige o vínculo pagamento↔NFC-e), mas nenhum fluxo o
 * grava ainda: não há captura TEF nem fechamento de caixa no V1. Esta entidade e a tabela existem
 * para o dia do PDV entrar sem migração de dados; o bloco TEF fica nulo até lá. Ver ADR/02A §4.1.
 */
export class OrderPayment extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _orderId: string,
    private readonly _method: OrderPaymentMethod,
    private readonly _paymentConditionId: string | null,
    private readonly _amount: number,
    private readonly _installments: number,
    private readonly _tef: TefBlock | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  // Entidade-filha do pedido; herda de AggregateRoot só pela base comum do projeto (não emite
  // eventos próprios). O ciclo de vida real chega com o PDV/TEF.

  static create(params: {
    accountId: string;
    orderId: string;
    method: OrderPaymentMethod;
    paymentConditionId?: string | null;
    amount: number;
    installments?: number | null;
    tef?: TefBlock | null;
  }): OrderPayment {
    if (!(params.amount > 0)) {
      throw new InvalidPaymentAmountException();
    }
    return new OrderPayment(
      randomUUID(),
      params.accountId,
      params.orderId,
      params.method,
      params.paymentConditionId ?? null,
      params.amount,
      Math.max(1, Math.trunc(params.installments ?? 1)),
      params.tef ?? null,
      new Date(),
    );
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get orderId(): string {
    return this._orderId;
  }
  get method(): OrderPaymentMethod {
    return this._method;
  }
  get paymentConditionId(): string | null {
    return this._paymentConditionId;
  }
  get amount(): number {
    return this._amount;
  }
  get installments(): number {
    return this._installments;
  }
  get tef(): TefBlock | null {
    return this._tef;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}

/** Bloco TEF (dormente). Preenchido só quando o PDV/TEF existir; nulo até lá. */
export interface TefBlock {
  provider: string | null;
  nsu: string | null;
  authorization: string | null;
  brand: string | null;
  status: string | null;
  payload: string | null;
  acquirerCnpj: string | null;
}
