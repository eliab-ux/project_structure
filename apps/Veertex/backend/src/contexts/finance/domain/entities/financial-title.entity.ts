import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { TitleDirection, TitleOrigin, TitleStatus } from '../title-enums';
import { TitleSettlement } from './title-settlement.entity';
import { round2 } from '../late-charges';
import {
  TitleOverSettlementException,
  TitleClosedException,
} from '../exceptions/finance-exceptions';

/**
 * Título financeiro (§2.1/§3 do 05) — a receber ou a pagar (uma tabela com direção). O valor original
 * é `amount`; a situação e o saldo são DERIVADOS das baixas (§2.1 — baixa parcial deixa saldo no
 * mesmo título, nunca em outro). Nunca DELETE; estorno é baixa nova (append-only).
 */
export class FinancialTitle extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _companyId: string,
    private readonly _direction: TitleDirection,
    private _contactId: string | null,
    private _categoryId: string | null,
    private _description: string,
    private readonly _amount: number,
    private readonly _issueDate: Date,
    private _dueDate: Date,
    private readonly _origin: TitleOrigin,
    private _settlements: TitleSettlement[],
    /** Sinalização MANUAL/automática que sobrepõe a derivação (perdida, renegociado — §3.4 do 04). */
    private _flaggedStatus: 'renegotiated' | 'written_off_pending' | 'written_off' | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    companyId: string;
    direction: TitleDirection;
    contactId?: string | null;
    categoryId?: string | null;
    description: string;
    amount: number;
    issueDate?: Date | null;
    dueDate: Date;
    origin?: TitleOrigin;
  }): FinancialTitle {
    return new FinancialTitle(
      randomUUID(),
      params.accountId,
      params.companyId,
      params.direction,
      params.contactId ?? null,
      params.categoryId ?? null,
      params.description.trim(),
      round2(Math.max(0, params.amount)),
      params.issueDate ?? new Date(),
      params.dueDate,
      params.origin ?? 'manual',
      [],
      null,
      new Date(),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static reconstitute(params: any): FinancialTitle {
    return new FinancialTitle(
      params.id,
      params.accountId,
      params.companyId,
      params.direction,
      params.contactId ?? null,
      params.categoryId ?? null,
      params.description,
      Number(params.amount),
      params.issueDate,
      params.dueDate,
      params.origin,
      params.settlements ?? [],
      params.flaggedStatus ?? null,
      params.createdAt,
    );
  }

  /** Principal já amortizado (só o principal das baixas conta para o saldo). */
  get settledPrincipal(): number {
    return round2(this._settlements.reduce((sum, s) => sum + s.principal, 0));
  }

  /** Saldo em aberto do título. */
  get openAmount(): number {
    return round2(this._amount - this.settledPrincipal);
  }

  get status(): TitleStatus {
    // Quitação VENCE a sinalização: pagamento posterior de um título "perdido" é baixa normal (§3.4).
    if (this.settledPrincipal >= this._amount) return 'settled';
    if (this._flaggedStatus) return this._flaggedStatus;
    if (this.settledPrincipal <= 0) return 'open';
    return 'partial';
  }

  /**
   * Política "perdida" (§3.4 do 04): após 1 cobrança + N recobranças sem recebimento, o título SAI
   * da carteira (não viaja mais) mas PERMANECE no FIN até ação manual — cancelar ou write-off.
   */
  flagWrittenOffPending(): void {
    if (this.status !== 'settled') {
      this._flaggedStatus = 'written_off_pending';
    }
  }

  /** Write-off manual (com permissão): baixa como despesa. Ação humana, nunca automática. */
  flagWrittenOff(): void {
    this._flaggedStatus = 'written_off';
  }

  /**
   * Registra uma baixa. O principal não pode exceder o saldo em aberto (baixa não vira crédito — isso
   * é `customer_credit`, fatia posterior). Título já quitado recusa nova baixa.
   */
  addSettlement(settlement: TitleSettlement): void {
    if (this.status === 'settled') {
      throw new TitleClosedException();
    }
    // Tolerância de 1 centavo para ruído de ponto flutuante.
    if (settlement.principal > this.openAmount + 0.001) {
      throw new TitleOverSettlementException(
        this.openAmount.toFixed(2),
        settlement.principal.toFixed(2),
      );
    }
    this._settlements = [...this._settlements, settlement];
  }

  editHeader(params: {
    description?: string;
    categoryId?: string | null;
    contactId?: string | null;
    dueDate?: Date | null;
  }): void {
    if (params.description !== undefined) this._description = params.description.trim();
    if (params.categoryId !== undefined) this._categoryId = params.categoryId;
    if (params.contactId !== undefined) this._contactId = params.contactId;
    if (params.dueDate !== undefined && params.dueDate) this._dueDate = params.dueDate;
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
  get direction(): TitleDirection {
    return this._direction;
  }
  get contactId(): string | null {
    return this._contactId;
  }
  get categoryId(): string | null {
    return this._categoryId;
  }
  get description(): string {
    return this._description;
  }
  get amount(): number {
    return this._amount;
  }
  get issueDate(): Date {
    return this._issueDate;
  }
  get dueDate(): Date {
    return this._dueDate;
  }
  get origin(): TitleOrigin {
    return this._origin;
  }
  get settlements(): readonly TitleSettlement[] {
    return this._settlements;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
