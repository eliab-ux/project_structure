import { AggregateRoot } from '@gitspread/domain-primitives';
import { OwnMediaId } from '../value-objects/own-media-id.vo';

/**
 * A piece of the tenant's own published Instagram media, mirrored locally for the SaaS.
 * Owned by a single tenant (ownerId). Identity toward Instagram is the pair
 * (ownerId, igMediaId); locally it is the generated OwnMediaId.
 */
export class OwnMedia extends AggregateRoot {
  private constructor(
    private readonly _id: OwnMediaId,
    private readonly _ownerId: string,
    private readonly _igMediaId: string,
    private _permalink: string,
    private _mediaType: string,
    private _caption: string | null,
    private _thumbnailUrl: string | null,
    private readonly _publishedAt: Date,
  ) {
    super();
  }

  static create(
    ownerId: string,
    igMediaId: string,
    permalink: string,
    mediaType: string,
    caption: string | null,
    thumbnailUrl: string | null,
    publishedAt: Date,
  ): OwnMedia {
    return new OwnMedia(
      OwnMediaId.generate(),
      ownerId,
      igMediaId,
      permalink,
      mediaType,
      caption,
      thumbnailUrl,
      publishedAt,
    );
  }

  static reconstitute(
    id: OwnMediaId,
    ownerId: string,
    igMediaId: string,
    permalink: string,
    mediaType: string,
    caption: string | null,
    thumbnailUrl: string | null,
    publishedAt: Date,
  ): OwnMedia {
    return new OwnMedia(
      id,
      ownerId,
      igMediaId,
      permalink,
      mediaType,
      caption,
      thumbnailUrl,
      publishedAt,
    );
  }

  /** Refreshes the mutable fields from a sync pull (upsert path). */
  updateFromSync(
    permalink: string,
    mediaType: string,
    caption: string | null,
    thumbnailUrl: string | null,
  ): void {
    this._permalink = permalink;
    this._mediaType = mediaType;
    this._caption = caption;
    this._thumbnailUrl = thumbnailUrl;
  }

  get id(): OwnMediaId {
    return this._id;
  }
  get ownerId(): string {
    return this._ownerId;
  }
  get igMediaId(): string {
    return this._igMediaId;
  }
  get permalink(): string {
    return this._permalink;
  }
  get mediaType(): string {
    return this._mediaType;
  }
  get caption(): string | null {
    return this._caption;
  }
  get thumbnailUrl(): string | null {
    return this._thumbnailUrl;
  }
  get publishedAt(): Date {
    return this._publishedAt;
  }
}
