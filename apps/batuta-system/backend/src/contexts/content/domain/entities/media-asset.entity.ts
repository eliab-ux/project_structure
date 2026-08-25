import { randomUUID } from 'crypto';
import { MediaKind } from '../value-objects/media-kind.vo';

/**
 * A file attached to a content, or to one specific variant (§4).
 *
 * The binary lives in MinIO; this holds the reference. `storageKey` is part of the content hash, so
 * swapping the image of an approved content invalidates the approval — the approver signed off on a
 * message WITH that image.
 */
export class MediaAsset {
  private constructor(
    private readonly _id: string,
    private readonly _variantId: string | null,
    private readonly _kind: MediaKind,
    private readonly _storageKey: string,
    private readonly _mimeType: string,
    private readonly _sizeBytes: number,
    private readonly _originalName: string,
  ) {}

  static create(params: {
    /** Null → the asset belongs to the content itself, not to a single variant. */
    variantId: string | null;
    kind: MediaKind;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    originalName: string;
  }): MediaAsset {
    return new MediaAsset(
      randomUUID(),
      params.variantId,
      params.kind,
      params.storageKey,
      params.mimeType,
      params.sizeBytes,
      params.originalName.trim().slice(0, 300),
    );
  }

  static reconstitute(params: {
    id: string;
    variantId: string | null;
    kind: MediaKind;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    originalName: string;
  }): MediaAsset {
    return new MediaAsset(
      params.id,
      params.variantId,
      params.kind,
      params.storageKey,
      params.mimeType,
      params.sizeBytes,
      params.originalName,
    );
  }

  get id(): string {
    return this._id;
  }

  get variantId(): string | null {
    return this._variantId;
  }

  get kind(): MediaKind {
    return this._kind;
  }

  get storageKey(): string {
    return this._storageKey;
  }

  get mimeType(): string {
    return this._mimeType;
  }

  get sizeBytes(): number {
    return this._sizeBytes;
  }

  get originalName(): string {
    return this._originalName;
  }

  /** Stable projection used to compute the content hash (§7 item 6: "referências de mídia"). */
  hashProjection(): string {
    return `media:${this._variantId ?? 'content'}:${this._kind}:${this._storageKey}`;
  }
}
