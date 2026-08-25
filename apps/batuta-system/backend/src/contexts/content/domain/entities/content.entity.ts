import { createHash } from 'crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { ContentId } from '../value-objects/content-id.vo';
import { ContentClassification } from '../value-objects/content-classification.vo';
import { ContentOrigin } from '../value-objects/content-origin.vo';
import {
  ContentStatus,
  editInvalidatesApproval,
  isDispatchable,
  isEditable,
} from '../value-objects/content-status.vo';
import { MediaKind } from '../value-objects/media-kind.vo';
import { ContentVariant } from './content-variant.entity';
import { MediaAsset } from './media-asset.entity';
import { validateMergeFields } from '../services/merge-fields';
import { ContentNotEditableException } from '../exceptions/content-not-editable.exception';
import { DuplicateVariantLabelException } from '../exceptions/duplicate-variant-label.exception';
import { InvalidMergeFieldException } from '../exceptions/invalid-merge-field.exception';
import { VariantNotFoundException } from '../exceptions/variant-not-found.exception';
import { MediaNotFoundException } from '../exceptions/media-not-found.exception';
import { ContentApprovalInvalidatedEvent } from '../events/content-approval-invalidated.event';
import { ContentNotSubmittableException } from '../exceptions/content-not-submittable.exception';

/**
 * A message to be distributed, with its variants and media.
 *
 * Variants and media are CHILDREN of this aggregate, not separate roots, for one concrete reason:
 * `content_hash` is the hash of the body plus the variants plus the media references (§7 item 6). If
 * a variant could be saved independently, the hash would drift out of sync with what was approved and
 * §8.5 would silently stop working.
 *
 * Two invariants live here and nowhere else:
 *  - `classification` is required at creation, with no default (§1.3);
 *  - every merge field must be known AND carry a fallback (§7.4) — validated on every write, so an
 *    invalid body cannot be persisted and can never reach the send path.
 */
export class Content extends AggregateRoot {
  private constructor(
    private readonly _id: ContentId,
    private readonly _accountId: string,
    private _title: string,
    private readonly _classification: ContentClassification,
    private readonly _origin: ContentOrigin,
    private _bodyBase: string,
    private _sourceUrl: string | null,
    private _includeSourceUrl: boolean,
    private _status: ContentStatus,
    private _contentHash: string,
    private readonly _createdBy: string,
    private _approvedAt: Date | null,
    private readonly _createdAt: Date,
    private _variants: ContentVariant[],
    private _media: MediaAsset[],
  ) {
    super();
  }

  static create(params: {
    accountId: string;
    title: string;
    /** No default anywhere in the system: the caller must state it (§1.3). */
    classification: ContentClassification;
    origin: ContentOrigin;
    bodyBase: string;
    sourceUrl?: string | null;
    /** Off by default: a link only reaches the contact when someone says so explicitly. */
    includeSourceUrl?: boolean;
    createdBy: string;
  }): Content {
    Content.assertValidBody(params.bodyBase);

    const content = new Content(
      ContentId.generate(),
      params.accountId,
      params.title.trim(),
      params.classification,
      params.origin,
      params.bodyBase,
      params.sourceUrl?.trim() || null,
      params.includeSourceUrl ?? false,
      ContentStatus.DRAFT,
      '',
      params.createdBy,
      null,
      new Date(),
      [],
      [],
    );

    content._contentHash = content.computeHash();
    return content;
  }

  static reconstitute(params: {
    id: ContentId;
    accountId: string;
    title: string;
    classification: ContentClassification;
    origin: ContentOrigin;
    bodyBase: string;
    sourceUrl: string | null;
    includeSourceUrl: boolean;
    status: ContentStatus;
    contentHash: string;
    createdBy: string;
    approvedAt: Date | null;
    createdAt: Date;
    variants: ContentVariant[];
    media: MediaAsset[];
  }): Content {
    return new Content(
      params.id,
      params.accountId,
      params.title,
      params.classification,
      params.origin,
      params.bodyBase,
      params.sourceUrl,
      params.includeSourceUrl,
      params.status,
      params.contentHash,
      params.createdBy,
      params.approvedAt,
      params.createdAt,
      params.variants,
      params.media,
    );
  }

  get id(): ContentId {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get title(): string {
    return this._title;
  }

  get classification(): ContentClassification {
    return this._classification;
  }

  get origin(): ContentOrigin {
    return this._origin;
  }

  get bodyBase(): string {
    return this._bodyBase;
  }

  /** The Instagram post this message came from (§7 item 3). Nothing in the system fetches it. */
  get sourceUrl(): string | null {
    return this._sourceUrl;
  }

  /**
   * Whether the link is appended to the message the contact receives.
   *
   * Off, it is provenance: metadata for the approver, invisible to the base, correctable without
   * touching an approval. On, it is part of the message — hashed, approved and audited like any
   * other text.
   */
  get includeSourceUrl(): boolean {
    return this._includeSourceUrl;
  }

  get status(): ContentStatus {
    return this._status;
  }

  get contentHash(): string {
    return this._contentHash;
  }

  get createdBy(): string {
    return this._createdBy;
  }

  get approvedAt(): Date | null {
    return this._approvedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get variants(): readonly ContentVariant[] {
    return [...this._variants].sort((a, b) => a.position - b.position);
  }

  get media(): readonly MediaAsset[] {
    return this._media;
  }

  get isDispatchable(): boolean {
    return isDispatchable(this._status);
  }

  /**
   * The media a send of `variantId` carries.
   *
   * Specificity wins, exactly as it does for the body: a variant that has its own attachment sends
   * that one, and a variant with none falls back to what is attached to the content. The two are
   * never merged — an attachment on the content is a default, not an extra.
   */
  mediaFor(variantId: string | null): MediaAsset[] {
    const own =
      variantId === null ? [] : this._media.filter((asset) => asset.variantId === variantId);
    return own.length > 0 ? own : this._media.filter((asset) => asset.variantId === null);
  }

  /**
   * Every text that could go out: the base plus each variant, each already carrying the source link
   * when the content is set to send it.
   *
   * The link is appended HERE, in the one place every send path already reads from — planning (which
   * freezes `rendered_body`, the audit evidence), the approval page, the preview and the caption-length
   * check. Appending it at send time instead would make the message differ from what was approved,
   * previewed and recorded, and nothing would notice.
   */
  get sendableBodies(): { variantId: string | null; label: string; body: string }[] {
    return [
      { variantId: null, label: 'Base', body: this.withSourceUrl(this._bodyBase) },
      ...this.variants.map((variant) => ({
        variantId: variant.id,
        label: variant.label,
        body: this.withSourceUrl(variant.body),
      })),
    ];
  }

  private withSourceUrl(body: string): string {
    if (!this._includeSourceUrl || !this._sourceUrl) {
      return body;
    }
    // A blank line, so WhatsApp renders the URL as its own clickable line instead of gluing it to the
    // last word of the text.
    return `${body}

${this._sourceUrl}`;
  }

  // ---------------------------------------------------------------- edits

  changeTitle(title: string): void {
    this.assertEditable();
    this._title = title.trim();
    this.registerChange();
  }

  changeBody(bodyBase: string): void {
    this.assertEditable();
    Content.assertValidBody(bodyBase);
    this._bodyBase = bodyBase;
    this.registerChange();
  }

  changeSourceUrl(sourceUrl: string | null): void {
    this.assertEditable();
    this._sourceUrl = sourceUrl?.trim() || null;
    // While the link stays provenance it is not part of the hash, so correcting a typo does not cost
    // an approval. Once it is being sent, it IS the message, and registerChange treats it as one —
    // computeHash decides which of the two applies, so there is no branch to get wrong here.
    this.registerChange();
  }

  /**
   * Turns the link into part of the message, or back into metadata.
   *
   * Either direction changes what the contact receives, so either direction costs the approval.
   */
  changeIncludeSourceUrl(include: boolean): void {
    this.assertEditable();
    this._includeSourceUrl = include;
    this.registerChange();
  }

  addVariant(params: { label: string; body: string; createdBy: string }): ContentVariant {
    this.assertEditable();
    Content.assertValidBody(params.body);

    const label = params.label.trim();
    if (this._variants.some((variant) => variant.label.toLowerCase() === label.toLowerCase())) {
      throw new DuplicateVariantLabelException();
    }

    const variant = ContentVariant.create({
      label,
      body: params.body,
      position: this._variants.length,
      createdBy: params.createdBy,
    });
    this._variants.push(variant);
    this.registerChange();
    return variant;
  }

  changeVariantBody(variantId: string, body: string): void {
    this.assertEditable();
    Content.assertValidBody(body);
    this.requireVariant(variantId).changeBody(body);
    this.registerChange();
  }

  markVariantReviewed(variantId: string, reviewedBy: string): void {
    this.assertEditable();
    // Reviewing does NOT change the message, so it does not touch the hash or the approval.
    this.requireVariant(variantId).markReviewed(reviewedBy);
  }

  removeVariant(variantId: string): void {
    this.assertEditable();
    const index = this._variants.findIndex((variant) => variant.id === variantId);
    if (index < 0) {
      throw new VariantNotFoundException();
    }
    this._variants.splice(index, 1);
    // Media attached to that variant goes with it: an orphan asset would still be in the hash.
    this._media = this._media.filter((asset) => asset.variantId !== variantId);
    this._variants.forEach((variant, position) => variant.changePosition(position));
    this.registerChange();
  }

  attachMedia(params: {
    variantId: string | null;
    kind: MediaKind;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    originalName: string;
  }): MediaAsset {
    this.assertEditable();
    if (params.variantId) {
      this.requireVariant(params.variantId);
    }

    const asset = MediaAsset.create(params);
    this._media.push(asset);
    this.registerChange();
    return asset;
  }

  removeMedia(mediaId: string): MediaAsset {
    this.assertEditable();
    const index = this._media.findIndex((asset) => asset.id === mediaId);
    if (index < 0) {
      throw new MediaNotFoundException();
    }
    const [removed] = this._media.splice(index, 1);
    this.registerChange();
    return removed;
  }

  // ---------------------------------------------------------------- approval flow (FASE 5)

  /**
   * Sends the content for approval (§8).
   *
   * Only a DRAFT can be submitted: submitting something already pending would create a second set of
   * requests for the same version, and submitting an APPROVED content is a no-op that would look like
   * progress. Note it does NOT touch the hash — submitting does not change the message.
   */
  submitForApproval(): void {
    this.assertEditable();
    if (this._status !== ContentStatus.DRAFT) {
      throw new ContentNotSubmittableException();
    }
    this._status = ContentStatus.PENDING_APPROVAL;
  }

  /**
   * Records that one more approval landed (§8.5: "APPROVED só quando o número necessário de
   * aprovações for atingido").
   *
   * The COUNT comes from the caller, which knows the account settings and how many requests are
   * already approved; the aggregate only decides what that count means for its own status. Below the
   * threshold nothing changes — the content stays pending, waiting for the second pair of eyes.
   *
   * @returns true when this approval completed the requirement.
   */
  registerApproval(approvedCount: number, requiredCount: number): boolean {
    this.assertEditable();
    if (this._status !== ContentStatus.PENDING_APPROVAL) {
      // A rejected or invalidated content does not get promoted by a late click on an old link.
      return false;
    }
    if (approvedCount < requiredCount) {
      return false;
    }

    this._status = ContentStatus.APPROVED;
    this._approvedAt = new Date();
    return true;
  }

  /**
   * One rejection is enough (§8.5). The comment reaches the author through the request row; the content
   * itself only needs to stop being distributable.
   */
  rejectApproval(): void {
    this.assertEditable();
    if (this._status !== ContentStatus.PENDING_APPROVAL) {
      return;
    }
    this._status = ContentStatus.REJECTED;
    this._approvedAt = null;
  }

  /**
   * Returns a rejected content to DRAFT so the author can respond to the rejection.
   *
   * Deliberately NOT an edit: it changes no text, so it must not touch the hash. Editing a REJECTED
   * content is also allowed directly (§8.5 excludes REJECTED from invalidation), and this exists for
   * the case where the author disagrees and resubmits the same words after a conversation.
   */
  returnToDraft(): void {
    this.assertEditable();
    if (this._status !== ContentStatus.REJECTED) {
      return;
    }
    this._status = ContentStatus.DRAFT;
  }

  /** Read-only from here on. Archiving is how content leaves circulation without being deleted. */
  archive(): void {
    this.assertEditable();
    this._status = ContentStatus.ARCHIVED;
  }

  // ---------------------------------------------------------------- hash and invalidation

  /**
   * Hash of the body + variants + media references (§7 item 6).
   *
   * Deterministic and order-independent: variants are hashed in `position` order and media
   * projections are sorted, so re-saving without changes produces the same hash and does NOT
   * invalidate an approval. That property is what makes §8.5 trustworthy instead of noisy.
   *
   * The title is excluded on purpose — it names the content, it is not part of the message.
   *
   * Provenance is excluded too, but ONLY while it stays provenance. The moment `includeSourceUrl` is
   * on, the link is text the contact receives, and leaving it out of the hash would mean a link could
   * be swapped after approval without invalidating anything — the approver would have signed off on
   * one destination and the base would receive another.
   */
  computeHash(): string {
    const parts = [
      `classification:${this._classification}`,
      `origin:${this._origin}`,
      `body:${this._bodyBase}`,
      `includeSourceUrl:${this._includeSourceUrl}`,
      ...(this._includeSourceUrl ? [`sourceUrl:${this._sourceUrl ?? ''}`] : []),
      ...this.variants.map((variant) => variant.hashProjection()),
      ...this._media.map((asset) => asset.hashProjection()).sort(),
    ];

    return createHash('sha256').update(parts.join('\n')).digest('hex');
  }

  /**
   * Recomputes the hash after an edit and, if the content had an approval, destroys it (§8.5):
   * requests become `INVALIDATED` and the content goes back to `DRAFT`.
   *
   * The handler that flips `approval_requests` lives in the approval context (FASE 5) and subscribes
   * to the emitted event — this aggregate must not know that approvals exist as rows.
   */
  private registerChange(): void {
    const previousHash = this._contentHash;
    this._contentHash = this.computeHash();

    if (this._contentHash === previousHash) {
      // Nothing about the message actually changed; an approval must survive a no-op save.
      return;
    }

    if (editInvalidatesApproval(this._status)) {
      const invalidatedFrom = this._status;
      this._status = ContentStatus.DRAFT;
      this._approvedAt = null;
      this.addDomainEvent(
        new ContentApprovalInvalidatedEvent(
          this._accountId,
          this._id.value,
          previousHash,
          this._contentHash,
          invalidatedFrom,
        ),
      );
      return;
    }

    // Editar um REJEITADO devolve para DRAFT, e sem evento de invalidação — não há aprovação a
    // invalidar, e a rejeição já é sobre a versão ANTERIOR do texto.
    //
    // Sem isto a rejeição é um beco sem saída: o autor corrige o que o aprovador apontou, o conteúdo
    // continua REJECTED, e `submitForApproval` exige DRAFT — ou seja, o texto corrigido não tem como
    // voltar para aprovação. Responder a uma rejeição é justamente o que editar aqui significa.
    if (this._status === ContentStatus.REJECTED) {
      this._status = ContentStatus.DRAFT;
    }
  }

  private assertEditable(): void {
    if (!isEditable(this._status)) {
      throw new ContentNotEditableException();
    }
  }

  private requireVariant(variantId: string): ContentVariant {
    const variant = this._variants.find((candidate) => candidate.id === variantId);
    if (!variant) {
      throw new VariantNotFoundException();
    }
    return variant;
  }

  /**
   * §7.4: every merge field must be known and carry a fallback. Enforced on EVERY write of a body,
   * base or variant — validation at the edge alone would let a second entry point through.
   */
  private static assertValidBody(body: string): void {
    const validation = validateMergeFields(body);
    if (!validation.valid) {
      throw new InvalidMergeFieldException(validation.issues.map((issue) => issue.message));
    }
  }
}
