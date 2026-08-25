import { Content } from '../../domain/entities/content.entity';
import { ContentClassification } from '../../domain/value-objects/content-classification.vo';
import { ContentOrigin } from '../../domain/value-objects/content-origin.vo';
import { ContentStatus } from '../../domain/value-objects/content-status.vo';
import { MediaKind } from '../../domain/value-objects/media-kind.vo';

export class ContentVariantDto {
  id!: string;
  label!: string;
  body!: string;
  position!: number;
  createdBy!: string;
  /** Null → nobody has reviewed this wording yet (§7 item 5). */
  reviewedBy!: string | null;
}

export class MediaAssetDto {
  id!: string;
  variantId!: string | null;
  kind!: MediaKind;
  mimeType!: string;
  sizeBytes!: number;
  originalName!: string;
  /** Time-limited URL, generated on read. The storage key never crosses this boundary. */
  downloadUrl!: string | null;
}

export class ContentDto {
  id!: string;
  title!: string;
  classification!: ContentClassification;
  origin!: ContentOrigin;
  bodyBase!: string;
  sourceUrl!: string | null;
  /** True when the link is appended to the message the contact receives. */
  includeSourceUrl!: boolean;
  status!: ContentStatus;
  /** Shown so an approver can see exactly which version they are looking at (§8 item 4). */
  contentHash!: string;
  /** Only APPROVED content may be planned or dispatched (§1.4). */
  isDispatchable!: boolean;
  createdBy!: string;
  approvedAt!: Date | null;
  createdAt!: Date;
  variants!: ContentVariantDto[];
  media!: MediaAssetDto[];

  static fromDomain(content: Content): ContentDto {
    const dto = new ContentDto();
    dto.id = content.id.value;
    dto.title = content.title;
    dto.classification = content.classification;
    dto.origin = content.origin;
    dto.bodyBase = content.bodyBase;
    dto.sourceUrl = content.sourceUrl;
    dto.includeSourceUrl = content.includeSourceUrl;
    dto.status = content.status;
    dto.contentHash = content.contentHash;
    dto.isDispatchable = content.isDispatchable;
    dto.createdBy = content.createdBy;
    dto.approvedAt = content.approvedAt;
    dto.createdAt = content.createdAt;
    dto.variants = content.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      body: variant.body,
      position: variant.position,
      createdBy: variant.createdBy,
      reviewedBy: variant.reviewedBy,
    }));
    dto.media = content.media.map((asset) => ({
      id: asset.id,
      variantId: asset.variantId,
      kind: asset.kind,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      originalName: asset.originalName,
      downloadUrl: null,
    }));
    return dto;
  }
}

/** One rendered example: which body, for which contact, and whether the fallback showed up. */
export class RenderedSampleDto {
  variantId!: string | null;
  variantLabel!: string;
  contactId!: string;
  contactPhoneMasked!: string;
  contactFirstName!: string | null;
  renderedBody!: string;
  /** True → this example is the fallback in action, which is why §7.4 demands one. */
  usedFallback!: boolean;
}

/**
 * The content preview (§7.4).
 *
 * `samples` are rendered against REAL contacts, with at least one lacking `first_name`, so the
 * operator sees "Olá amigo" before a real person does.
 */
export class ContentPreviewDto {
  contentId!: string;
  contentHash!: string;
  /** Merge fields found, so the UI can show what will be personalised. */
  mergeFields!: { name: string; fallback: string | null }[];
  samples!: RenderedSampleDto[];
  /** How many of the sampled contacts have no first name. */
  sampledWithoutFirstName!: number;
  /**
   * Set when the audience is too small (or empty) to build a full sample — never a silent
   * short preview.
   */
  warning!: string | null;
}
