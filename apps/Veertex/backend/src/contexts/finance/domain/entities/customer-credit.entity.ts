import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidSettlementException } from '../exceptions/finance-exceptions';

export type CustomerCreditStatus = 'open' | 'consumed' | 'cancelled';

/**
 * CRÉDITO DO CLIENTE (05 §2.5) — nasce na DEVOLUÇÃO pós-FIS: se o título já estava recebido, o
 * estorno não devolve dinheiro, gera crédito consumível em título futuro.
 *
 * ## Dormente até o FIS (fronteira declarada — mesmo padrão do bloco TEF do pedido)
 * O schema NASCE pronto e nenhum fluxo o grava ainda: a devolução é operação coordenada
 * VND+EST+FIN que o 02 §3.8 tranca até FIS e FIN existirem juntos — e o FIS é a última fatia da
 * fila. Entidade e tabela existem para o dia da devolução entrar sem migração de dados; nenhuma
 * tela oferece crédito e nenhum endpoint o cria. Coluna nula é dado ausente, não promessa.
 *
 * ## Invariantes (valem desde já — o teste as prova)
 * - o crédito nunca nasce com valor ≤ 0;
 * - consumo é PARCIAL no MESMO crédito (espelho da baixa parcial do título): `remainingAmount`
 *   decresce, nunca abaixo de zero, e o status vira `consumed` quando zera;
 * - consumo/cancelamento são transições — crédito consumido ou cancelado não se consome de novo.
 */
export class CustomerCredit extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _companyId: string,
    private readonly _contactId: string,
    /** O título cujo estorno originou o crédito — a trilha da devolução. */
    private readonly _originTitleId: string | null,
    private readonly _amount: number,
    private _remainingAmount: number,
    private _status: CustomerCreditStatus,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    companyId: string;
    contactId: string;
    originTitleId?: string | null;
    amount: number;
  }): CustomerCredit {
    if (!(params.amount > 0)) {
      throw new InvalidSettlementException('Crédito de cliente precisa de valor positivo.');
    }
    return new CustomerCredit(
      randomUUID(),
      params.accountId,
      params.companyId,
      params.contactId,
      params.originTitleId ?? null,
      params.amount,
      params.amount,
      'open',
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    companyId: string;
    contactId: string;
    originTitleId: string | null;
    amount: number;
    remainingAmount: number;
    status: CustomerCreditStatus;
    createdAt: Date;
  }): CustomerCredit {
    return new CustomerCredit(
      params.id,
      params.accountId,
      params.companyId,
      params.contactId,
      params.originTitleId,
      params.amount,
      params.remainingAmount,
      params.status,
      params.createdAt,
    );
  }

  /** Consome parte (ou tudo) do crédito num título futuro. Parcial deixa saldo no MESMO crédito. */
  consume(amount: number): void {
    if (this._status !== 'open') {
      throw new InvalidSettlementException('Crédito já consumido ou cancelado.');
    }
    if (!(amount > 0) || amount > this._remainingAmount + 1e-9) {
      throw new InvalidSettlementException(
        `Consumo inválido: disponível ${this._remainingAmount.toFixed(2)}.`,
      );
    }
    this._remainingAmount = Math.round((this._remainingAmount - amount) * 100) / 100;
    if (this._remainingAmount <= 0) {
      this._remainingAmount = 0;
      this._status = 'consumed';
    }
  }

  cancel(): void {
    if (this._status !== 'open') {
      throw new InvalidSettlementException('Crédito já consumido ou cancelado.');
    }
    this._status = 'cancelled';
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
  get contactId(): string {
    return this._contactId;
  }
  get originTitleId(): string | null {
    return this._originTitleId;
  }
  get amount(): number {
    return this._amount;
  }
  get remainingAmount(): number {
    return this._remainingAmount;
  }
  get status(): CustomerCreditStatus {
    return this._status;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
