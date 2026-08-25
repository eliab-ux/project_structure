import { randomUUID } from 'crypto';

/**
 * A variant of the same content, for audience fit (§7 item 5).
 *
 * `createdBy` and `reviewedBy` are recorded because the spec is explicit that every variant is
 * written or reviewed BY A HUMAN — and §2 forbids automatic variant generation outright, since
 * generating variants to dodge duplicate detection is the behaviour that gets numbers banned.
 * These two columns are what makes that auditable rather than aspirational.
 */
export class ContentVariant {
  private constructor(
    private readonly _id: string,
    private _label: string,
    private _body: string,
    private _position: number,
    private readonly _createdBy: string,
    private _reviewedBy: string | null,
  ) {}

  static create(params: {
    label: string;
    body: string;
    position: number;
    createdBy: string;
  }): ContentVariant {
    return new ContentVariant(
      randomUUID(),
      params.label.trim(),
      params.body,
      params.position,
      params.createdBy,
      null,
    );
  }

  static reconstitute(params: {
    id: string;
    label: string;
    body: string;
    position: number;
    createdBy: string;
    reviewedBy: string | null;
  }): ContentVariant {
    return new ContentVariant(
      params.id,
      params.label,
      params.body,
      params.position,
      params.createdBy,
      params.reviewedBy,
    );
  }

  get id(): string {
    return this._id;
  }

  get label(): string {
    return this._label;
  }

  get body(): string {
    return this._body;
  }

  get position(): number {
    return this._position;
  }

  get createdBy(): string {
    return this._createdBy;
  }

  /** Null until a human other than the author reviewed it. */
  get reviewedBy(): string | null {
    return this._reviewedBy;
  }

  changeBody(body: string): void {
    this._body = body;
    // Any edit invalidates a previous review: what was reviewed is no longer what is there.
    this._reviewedBy = null;
  }

  changeLabel(label: string): void {
    this._label = label.trim();
  }

  changePosition(position: number): void {
    this._position = position;
  }

  markReviewed(reviewedBy: string): void {
    this._reviewedBy = reviewedBy;
  }

  /** Stable projection used to compute the content hash. */
  hashProjection(): string {
    return `variant:${this._label}:${this._position}:${this._body}`;
  }
}
