import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import {
  InvalidTripTransitionException,
  TripNotOpenForCargoException,
} from '../exceptions/route-exceptions';

/**
 * Situações da viagem (§2 do 04). `planejada` (montagem/carga) → `em_andamento` (saiu) →
 * `em_fechamento` (voltou; acertos e batimento em curso) → `fechada` (fechamento efetivado — o
 * gatilho da comissão B, fatia 5), + `cancelada`. A carga (romaneio) só entra em `planejada`;
 * despesas e caixa de retorno entram até o fechamento.
 */
export const TRIP_STATUSES = [
  'planejada',
  'em_andamento',
  'em_fechamento',
  'fechada',
  'cancelada',
] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  planejada: 'Planejada',
  em_andamento: 'Em andamento',
  em_fechamento: 'Em fechamento',
  fechada: 'Fechada',
  cancelada: 'Cancelada',
};

const TRIP_TRANSITIONS: Record<TripStatus, readonly TripStatus[]> = {
  planejada: ['em_andamento', 'cancelada'],
  em_andamento: ['em_fechamento', 'cancelada'],
  em_fechamento: ['fechada'],
  fechada: [],
  cancelada: [],
};

/**
 * Viagem (`trip`, §2 do 04): execução de uma rota por **1 representante** (1×1, decisão fechada) +
 * ajudante opcional (fixo semanal, não vende). Carrega caixa inicial/de retorno (dinheiro) e km
 * inicial/final. A localização de carga (`rep_load`, 03A) é criada na primeira carga e fica
 * apontada aqui — é onde o estoque consignado "vive" durante a viagem.
 */
export class Trip extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _companyId: string,
    private readonly _routeId: string,
    private readonly _salesRepId: string,
    private _helperUserId: string | null,
    private _status: TripStatus,
    private _departureAt: Date | null,
    private _returnAt: Date | null,
    private _initialCash: number,
    private _returnCash: number | null,
    private _initialKm: number | null,
    private _finalKm: number | null,
    private _loadLocationId: string | null,
    private _closure: TripClosureInputs | null,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    companyId: string;
    routeId: string;
    salesRepId: string;
    helperUserId?: string | null;
    initialCash?: number | null;
    initialKm?: number | null;
  }): Trip {
    return new Trip(
      randomUUID(),
      params.accountId,
      params.companyId,
      params.routeId,
      params.salesRepId,
      params.helperUserId ?? null,
      'planejada',
      null,
      null,
      Math.max(0, params.initialCash ?? 0),
      null,
      params.initialKm ?? null,
      null,
      null,
      null,
      new Date(),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static reconstitute(params: any): Trip {
    return new Trip(
      params.id,
      params.accountId,
      params.companyId,
      params.routeId,
      params.salesRepId,
      params.helperUserId ?? null,
      params.status,
      params.departureAt ?? null,
      params.returnAt ?? null,
      Number(params.initialCash ?? 0),
      params.returnCash === null || params.returnCash === undefined
        ? null
        : Number(params.returnCash),
      params.initialKm === null || params.initialKm === undefined ? null : Number(params.initialKm),
      params.finalKm === null || params.finalKm === undefined ? null : Number(params.finalKm),
      params.loadLocationId ?? null,
      params.closure ?? null,
      params.createdAt,
    );
  }

  /** A carga (romaneio) só entra com a viagem PLANEJADA — depois de sair, carga nova não existe. */
  assertAcceptsCargo(): void {
    if (this._status !== 'planejada') {
      throw new TripNotOpenForCargoException(this._status);
    }
  }

  /** A localização `rep_load` da viagem, criada na primeira carga. */
  attachLoadLocation(locationId: string): void {
    this._loadLocationId = locationId;
  }

  /** planejada → em_andamento: a saída. Registra o momento. */
  depart(): void {
    this.transitionTo('em_andamento');
    this._departureAt = new Date();
  }

  /** em_andamento → em_fechamento: a volta; acertos e batimento começam. */
  arrive(params?: { returnCash?: number | null; finalKm?: number | null }): void {
    this.transitionTo('em_fechamento');
    this._returnAt = new Date();
    if (params?.returnCash !== undefined && params.returnCash !== null) {
      this._returnCash = Math.max(0, params.returnCash);
    }
    if (params?.finalKm !== undefined && params.finalKm !== null) {
      this._finalKm = params.finalKm;
    }
  }

  /** em_fechamento → fechada: efetivação do fechamento (fatia 5 dispara a comissão B aqui). */
  close(): void {
    this.transitionTo('fechada');
  }

  /**
   * Persiste os INPUTS e resultados da folha do fechamento na viagem — o batimento fica reproduzível
   * deterministicamente dos dados gravados (nenhum input vive só no request), e a % da faixa aplicada
   * fica congelada contra mudança futura das faixas.
   */
  registerClosure(closure: TripClosureInputs): void {
    this._closure = closure;
  }

  cancel(): void {
    this.transitionTo('cancelada');
  }

  editHeader(params: {
    helperUserId?: string | null;
    initialCash?: number | null;
    returnCash?: number | null;
    initialKm?: number | null;
    finalKm?: number | null;
  }): void {
    if (params.helperUserId !== undefined) this._helperUserId = params.helperUserId;
    if (params.initialCash !== undefined && params.initialCash !== null) {
      this._initialCash = Math.max(0, params.initialCash);
    }
    if (params.returnCash !== undefined) {
      this._returnCash = params.returnCash === null ? null : Math.max(0, params.returnCash);
    }
    if (params.initialKm !== undefined) this._initialKm = params.initialKm;
    if (params.finalKm !== undefined) this._finalKm = params.finalKm;
  }

  private transitionTo(to: TripStatus): void {
    if (!TRIP_TRANSITIONS[this._status].includes(to)) {
      throw new InvalidTripTransitionException(this._status, to);
    }
    this._status = to;
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
  get routeId(): string {
    return this._routeId;
  }
  get salesRepId(): string {
    return this._salesRepId;
  }
  get helperUserId(): string | null {
    return this._helperUserId;
  }
  get status(): TripStatus {
    return this._status;
  }
  get departureAt(): Date | null {
    return this._departureAt;
  }
  get returnAt(): Date | null {
    return this._returnAt;
  }
  get initialCash(): number {
    return this._initialCash;
  }
  get returnCash(): number | null {
    return this._returnCash;
  }
  get initialKm(): number | null {
    return this._initialKm;
  }
  get finalKm(): number | null {
    return this._finalKm;
  }
  get loadLocationId(): string | null {
    return this._loadLocationId;
  }
  get closure(): TripClosureInputs | null {
    return this._closure;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}

/** Inputs manuais + resultados congelados do fechamento (persistidos em `trips`). */
export interface TripClosureInputs {
  managerUserId: string | null;
  managerPercent: number | null;
  helperAmount: number | null;
  commissionPercent: number | null;
  repCommission: number | null;
}
