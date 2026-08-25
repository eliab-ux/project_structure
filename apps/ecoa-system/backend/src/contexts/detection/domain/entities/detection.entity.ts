import { AggregateRoot } from '@gitspread/domain-primitives';
import { DetectionId } from '../value-objects/detection-id.vo';
import { DetectionType } from '../value-objects/detection-type.vo';

/**
 * A detected inbound Instagram interaction (story mention, tag or mention) against the
 * tenant's content or handle. Owned by a single tenant (ownerId). When the source matched
 * the tenant's watchlist, `watchedAccountId` is set — such detections are "highlighted".
 */
export class Detection extends AggregateRoot {
  private constructor(
    private readonly _id: DetectionId,
    private readonly _ownerId: string,
    private readonly _ownMediaId: string | null,
    private readonly _watchedAccountId: string | null,
    private readonly _sourceUsername: string,
    private readonly _detectionType: DetectionType,
    private readonly _detectedAt: Date,
    private readonly _permalink: string | null,
    private _seen: boolean,
  ) {
    super();
  }

  static register(props: {
    ownerId: string;
    sourceUsername: string;
    detectionType: DetectionType;
    ownMediaId?: string | null;
    watchedAccountId?: string | null;
    permalink?: string | null;
    detectedAt?: Date;
  }): Detection {
    return new Detection(
      DetectionId.generate(),
      props.ownerId,
      props.ownMediaId ?? null,
      props.watchedAccountId ?? null,
      props.sourceUsername,
      props.detectionType,
      props.detectedAt ?? new Date(),
      props.permalink ?? null,
      false,
    );
  }

  static reconstitute(
    id: DetectionId,
    ownerId: string,
    ownMediaId: string | null,
    watchedAccountId: string | null,
    sourceUsername: string,
    detectionType: DetectionType,
    detectedAt: Date,
    permalink: string | null,
    seen: boolean,
  ): Detection {
    return new Detection(
      id,
      ownerId,
      ownMediaId,
      watchedAccountId,
      sourceUsername,
      detectionType,
      detectedAt,
      permalink,
      seen,
    );
  }

  markSeen(): void {
    this._seen = true;
  }

  get id(): DetectionId {
    return this._id;
  }
  get ownerId(): string {
    return this._ownerId;
  }
  get ownMediaId(): string | null {
    return this._ownMediaId;
  }
  get watchedAccountId(): string | null {
    return this._watchedAccountId;
  }
  get sourceUsername(): string {
    return this._sourceUsername;
  }
  get detectionType(): DetectionType {
    return this._detectionType;
  }
  get detectedAt(): Date {
    return this._detectedAt;
  }
  get permalink(): string | null {
    return this._permalink;
  }
  get seen(): boolean {
    return this._seen;
  }

  /** A detection is highlighted when its source matched the tenant's watchlist. */
  get highlighted(): boolean {
    return this._watchedAccountId != null;
  }
}
