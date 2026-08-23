import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';

/** Tipos de evidência do pedido consignado (§3.1 do 04). */
export const EVIDENCE_TYPES = ['gps', 'foto_comprovante', 'foto_promissoria'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

/**
 * Evidência do pedido (§3.1 do 04). **Append-only**: o GPS capturado na abertura é IMUTÁVEL —
 * edições do pedido nunca o tocam; a "alteração" é uma evidência NOVA apontando a anterior
 * (`previousEvidenceId`), com quem/quando/motivo — a trilha exigida pelo aceite 2. A vigente é a
 * mais recente da cadeia.
 *
 * Fotos guardam a CHAVE do objeto (bucket/key — a URL é montada na leitura, nunca persistida,
 * CLAUDE.md/MinIO). O upload físico espera o adapter de storage (dependência `minio` — gatilho de
 * parada registrado); a chave já nasce para o dado não migrar.
 */
export class OrderEvidence extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _orderId: string,
    private readonly _tripId: string | null,
    private readonly _type: EvidenceType,
    private readonly _latitude: number | null,
    private readonly _longitude: number | null,
    private readonly _objectKey: string | null,
    private readonly _previousEvidenceId: string | null,
    private readonly _changedByUserId: string | null,
    private readonly _changeReason: string | null,
    private readonly _capturedAt: Date,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    orderId: string;
    tripId?: string | null;
    type: EvidenceType;
    latitude?: number | null;
    longitude?: number | null;
    objectKey?: string | null;
    previousEvidenceId?: string | null;
    changedByUserId?: string | null;
    changeReason?: string | null;
    capturedAt?: Date | null;
  }): OrderEvidence {
    return new OrderEvidence(
      randomUUID(),
      params.accountId,
      params.orderId,
      params.tripId ?? null,
      params.type,
      params.latitude ?? null,
      params.longitude ?? null,
      params.objectKey ?? null,
      params.previousEvidenceId ?? null,
      params.changedByUserId ?? null,
      params.changeReason?.trim() || null,
      params.capturedAt ?? new Date(),
      new Date(),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static reconstitute(params: any): OrderEvidence {
    return new OrderEvidence(
      params.id,
      params.accountId,
      params.orderId,
      params.tripId ?? null,
      params.type,
      params.latitude === null || params.latitude === undefined ? null : Number(params.latitude),
      params.longitude === null || params.longitude === undefined ? null : Number(params.longitude),
      params.objectKey ?? null,
      params.previousEvidenceId ?? null,
      params.changedByUserId ?? null,
      params.changeReason ?? null,
      params.capturedAt,
      params.createdAt,
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
  get tripId(): string | null {
    return this._tripId;
  }
  get type(): EvidenceType {
    return this._type;
  }
  get latitude(): number | null {
    return this._latitude;
  }
  get longitude(): number | null {
    return this._longitude;
  }
  get objectKey(): string | null {
    return this._objectKey;
  }
  get previousEvidenceId(): string | null {
    return this._previousEvidenceId;
  }
  get changedByUserId(): string | null {
    return this._changedByUserId;
  }
  get changeReason(): string | null {
    return this._changeReason;
  }
  get capturedAt(): Date {
    return this._capturedAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
