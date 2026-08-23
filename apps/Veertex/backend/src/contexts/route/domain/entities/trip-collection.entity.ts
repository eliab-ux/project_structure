import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';

/**
 * Item da CARTEIRA da viagem (§3.4 do 04): um título (FIN) que esta viagem cobra. `cobranca` na
 * primeira passagem que o cobra; `recobranca` quando rolou de passagem anterior. O recebimento em
 * campo referencia título + viagem — esta linha é a base do % de recebimento da comissão B.
 */
export const COLLECTION_KINDS = ['cobranca', 'recobranca'] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

export class TripCollection extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _tripId: string,
    private readonly _titleId: string,
    private readonly _kind: CollectionKind,
    /** Saldo do título NO MOMENTO da montagem — congela a carteira (o denominador da razão B). */
    private readonly _amountAtBuild: number,
    private readonly _createdAt: Date,
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    tripId: string;
    titleId: string;
    kind: CollectionKind;
    amountAtBuild: number;
  }): TripCollection {
    return new TripCollection(
      randomUUID(),
      params.accountId,
      params.tripId,
      params.titleId,
      params.kind,
      Math.max(0, params.amountAtBuild),
      new Date(),
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    tripId: string;
    titleId: string;
    kind: CollectionKind;
    amountAtBuild: number;
    createdAt: Date;
  }): TripCollection {
    return new TripCollection(
      params.id,
      params.accountId,
      params.tripId,
      params.titleId,
      params.kind,
      params.amountAtBuild,
      params.createdAt,
    );
  }

  get id(): string {
    return this._id;
  }
  get accountId(): string {
    return this._accountId;
  }
  get tripId(): string {
    return this._tripId;
  }
  get titleId(): string {
    return this._titleId;
  }
  get kind(): CollectionKind {
    return this._kind;
  }
  get amountAtBuild(): number {
    return this._amountAtBuild;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
}
