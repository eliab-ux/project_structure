import { AggregateRoot } from '@gitspread/domain-primitives';
import { SnapshotId } from '../value-objects/snapshot-id.vo';

/** The raw insight metrics of a single capture, as read from Instagram. */
export interface SnapshotMetrics {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saved: number;
  sharesCount: number;
}

/**
 * A single point-in-time reading of a tenant media's insight metrics. Each capture is an
 * immutable row; many captures over time form the media's time series. Owned by a single
 * tenant (ownerId); scoped locally to an OwnMedia via ownMediaId.
 */
export class MediaInsightSnapshot extends AggregateRoot {
  private constructor(
    private readonly _id: SnapshotId,
    private readonly _ownerId: string,
    private readonly _ownMediaId: string,
    private readonly _capturedAt: Date,
    private readonly _reach: number,
    private readonly _impressions: number,
    private readonly _likes: number,
    private readonly _comments: number,
    private readonly _saved: number,
    private readonly _sharesCount: number,
  ) {
    super();
  }

  static capture(
    ownerId: string,
    ownMediaId: string,
    metrics: SnapshotMetrics,
    capturedAt: Date = new Date(),
  ): MediaInsightSnapshot {
    return new MediaInsightSnapshot(
      SnapshotId.generate(),
      ownerId,
      ownMediaId,
      capturedAt,
      metrics.reach,
      metrics.impressions,
      metrics.likes,
      metrics.comments,
      metrics.saved,
      metrics.sharesCount,
    );
  }

  static reconstitute(
    id: SnapshotId,
    ownerId: string,
    ownMediaId: string,
    capturedAt: Date,
    reach: number,
    impressions: number,
    likes: number,
    comments: number,
    saved: number,
    sharesCount: number,
  ): MediaInsightSnapshot {
    return new MediaInsightSnapshot(
      id,
      ownerId,
      ownMediaId,
      capturedAt,
      reach,
      impressions,
      likes,
      comments,
      saved,
      sharesCount,
    );
  }

  get id(): SnapshotId {
    return this._id;
  }
  get ownerId(): string {
    return this._ownerId;
  }
  get ownMediaId(): string {
    return this._ownMediaId;
  }
  get capturedAt(): Date {
    return this._capturedAt;
  }
  get reach(): number {
    return this._reach;
  }
  get impressions(): number {
    return this._impressions;
  }
  get likes(): number {
    return this._likes;
  }
  get comments(): number {
    return this._comments;
  }
  get saved(): number {
    return this._saved;
  }
  get sharesCount(): number {
    return this._sharesCount;
  }
}
