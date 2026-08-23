import { randomUUID } from 'node:crypto';
import { round2 } from '../late-charges';

/** Forma da baixa (§2.1 do 05). */
export const SETTLEMENT_METHODS = [
  'dinheiro',
  'pix',
  'cartao',
  'boleto',
  'cheque',
  'transferencia',
  'outro',
] as const;
export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number];

/**
 * Baixa de um título (§2.1 do 05) — **append-only**: estorno é baixa nova, nunca alteração. Carrega
 * a conta financeira, a forma, o principal amortizado e os encargos (juros/multa/desconto). Só o
 * `principal` reduz o saldo do título; juros e multa são valores A MAIS, desconto é a menos no caixa.
 */
export class TitleSettlement {
  private constructor(
    private readonly _id: string,
    private readonly _financialAccountId: string,
    private readonly _method: SettlementMethod,
    private readonly _principal: number,
    private readonly _interest: number,
    private readonly _fine: number,
    private readonly _discount: number,
    private readonly _settledAt: Date,
  ) {}

  static create(params: {
    id?: string;
    financialAccountId: string;
    method: SettlementMethod;
    principal: number;
    interest?: number;
    fine?: number;
    discount?: number;
    settledAt: Date;
  }): TitleSettlement {
    return new TitleSettlement(
      params.id ?? randomUUID(),
      params.financialAccountId,
      params.method,
      round2(Math.max(0, params.principal)),
      round2(Math.max(0, params.interest ?? 0)),
      round2(Math.max(0, params.fine ?? 0)),
      round2(Math.max(0, params.discount ?? 0)),
      params.settledAt,
    );
  }

  /** Total efetivamente movimentado na conta financeira: principal + juros + multa − desconto. */
  get cashAmount(): number {
    return round2(this._principal + this._interest + this._fine - this._discount);
  }

  get id(): string {
    return this._id;
  }
  get financialAccountId(): string {
    return this._financialAccountId;
  }
  get method(): SettlementMethod {
    return this._method;
  }
  get principal(): number {
    return this._principal;
  }
  get interest(): number {
    return this._interest;
  }
  get fine(): number {
    return this._fine;
  }
  get discount(): number {
    return this._discount;
  }
  get settledAt(): Date {
    return this._settledAt;
  }
}
