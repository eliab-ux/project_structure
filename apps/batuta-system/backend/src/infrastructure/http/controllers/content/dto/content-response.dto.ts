import {
  ContentDto,
  ContentPreviewDto,
} from '../../../../../contexts/content/application/dto/content.dto';

export class ContentVariantResponseDto {
  id!: string;
  label!: string;
  body!: string;
  position!: number;
  createdBy!: string;
  /** Null → nobody reviewed this wording yet (§7 item 5). */
  reviewedBy!: string | null;
}

export class MediaAssetResponseDto {
  id!: string;
  variantId!: string | null;
  kind!: string;
  mimeType!: string;
  sizeBytes!: number;
  originalName!: string;
  /** Time-limited signed URL. The storage key never crosses this boundary. */
  downloadUrl!: string | null;
}

export class ContentResponseDto {
  id!: string;
  title!: string;
  classification!: string;
  origin!: string;
  bodyBase!: string;
  sourceUrl!: string | null;
  includeSourceUrl!: boolean;
  status!: string;
  /** The exact version identifier an approver sees and signs off on (§8 item 4). */
  contentHash!: string;
  isDispatchable!: boolean;
  createdBy!: string;
  approvedAt!: string | null;
  createdAt!: string;
  variants!: ContentVariantResponseDto[];
  media!: MediaAssetResponseDto[];

  static from(content: ContentDto): ContentResponseDto {
    const dto = new ContentResponseDto();
    dto.id = content.id;
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
    dto.approvedAt = content.approvedAt?.toISOString() ?? null;
    dto.createdAt = content.createdAt.toISOString();
    dto.variants = content.variants.map((variant) => ({ ...variant }));
    dto.media = content.media.map((asset) => ({ ...asset }));
    return dto;
  }
}

/** The preview of §7.4: real contacts, at least one showing the fallback. */
export class ContentPreviewResponseDto {
  contentId!: string;
  contentHash!: string;
  mergeFields!: { name: string; fallback: string | null }[];
  samples!: {
    variantId: string | null;
    variantLabel: string;
    contactId: string;
    contactPhoneMasked: string;
    contactFirstName: string | null;
    renderedBody: string;
    usedFallback: boolean;
  }[];
  sampledWithoutFirstName!: number;
  /** Non-null when the sample could not be built as specified — never a silent short preview. */
  warning!: string | null;

  static from(preview: ContentPreviewDto): ContentPreviewResponseDto {
    const dto = new ContentPreviewResponseDto();
    dto.contentId = preview.contentId;
    dto.contentHash = preview.contentHash;
    dto.mergeFields = preview.mergeFields.map((field) => ({ ...field }));
    dto.samples = preview.samples.map((sample) => ({ ...sample }));
    dto.sampledWithoutFirstName = preview.sampledWithoutFirstName;
    dto.warning = preview.warning;
    return dto;
  }
}
