import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { InvalidChargeException } from '../exceptions/billing-exceptions';

export const CHARGE_KINDS = ['boleto', 'pix'] as const;
export type ChargeKind = (typeof CHARGE_KINDS)[number];

export const CHARGE_STATUSES = ['registered', 'paid', 'cancelled', 'error'] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

export const CHARGE_STATUS_LABEL: Record<ChargeStatus, string> = {
  registered: 'Registrada',
  paid: 'Paga',
  cancelled: 'Cancelada',
  error: 'Erro',
};

/**
 * O INSTRUMENTO de cobrança (06 §2.1): boleto registrado ou Pix emitido pelo agregador a partir de
 * um título a receber do FIN. O título é a dívida; a charge é o pedaço de papel/QR que a cobra —
 * um título pode ter mais de uma charge na vida (2ª via, troca de instrumento), mas só UMA ativa.
 *
 * `providerChargeId` é a chave da conversa com o agregador (webhook resolve por ele). O PDF vai ao
 * storage e a CHAVE fica aqui (URL nunca persistida — mesma regra das evidências).
 */
export class Charge extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _companyId: string,
    private readonly _titleId: string,
    private readonly _kind: ChargeKind,
    private _status: ChargeStatus,
    private readonly _provider: string,
    private _providerChargeId: string | null,
    private _digitableLine: string | null,
    private _pixQrCode: string | null,
    private _pdfObjectKey: string | null,
    private _paidAt: Date | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    companyId: string;
    titleId: string;
    kind: ChargeKind;
    provider: string;
    providerChargeId?: string | null;
    digitableLine?: string | null;
    pixQrCode?: string | null;
    pdfObjectKey?: string | null;
  }): Charge {
    if (!CHARGE_KINDS.includes(params.kind)) {
      throw new InvalidChargeException(`Instrumento desconhecido: ${String(params.kind)}.`);
    }
    return new Charge(
      randomUUID(),
      params.accountId,
      params.companyId,
      params.titleId,
      params.kind,
      'registered',
      params.provider,
      params.providerChargeId ?? null,
      params.digitableLine ?? null,
      params.pixQrCode ?? null,
      params.pdfObjectKey ?? null,
      null,
      new Date(),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static reconstitute(params: any): Charge {
    return new Charge(
      params.id,
      params.accountId,
      params.companyId,
      params.titleId,
      params.kind,
      params.status,
      params.provider,
      params.providerChargeId ?? null,
      params.digitableLine ?? null,
      params.pixQrCode ?? null,
      params.pdfObjectKey ?? null,
      params.paidAt ?? null,
      params.createdAt,
    );
  }

  /** O webhook confirmou o pagamento — idempotente: pagar de novo não muda nada. */
  markPaid(paidAt: Date): void {
    if (this._status === 'paid') {
      return;
    }
    this._status = 'paid';
    this._paidAt = paidAt;
  }

  cancel(): void {
    if (this._status === 'paid') {
      throw new InvalidChargeException('Cobrança paga não se cancela.');
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
  get titleId(): string {
    return this._titleId;
  }
  get kind(): ChargeKind {
    return this._kind;
  }
  get status(): ChargeStatus {
    return this._status;
  }
  get provider(): string {
    return this._provider;
  }
  get providerChargeId(): string | null {
    return this._providerChargeId;
  }
  get digitableLine(): string | null {
    return this._digitableLine;
  }
  get pixQrCode(): string | null {
    return this._pixQrCode;
  }
  get pdfObjectKey(): string | null {
    return this._pdfObjectKey;
  }
  get paidAt(): Date | null {
    return this._paidAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
