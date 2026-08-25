import { Injectable } from '@nestjs/common';
import { Content } from '../../../../contexts/content/domain/entities/content.entity';
import { ContentVariant } from '../../../../contexts/content/domain/entities/content-variant.entity';
import { MediaAsset } from '../../../../contexts/content/domain/entities/media-asset.entity';
import { ContentId } from '../../../../contexts/content/domain/value-objects/content-id.vo';
import { ContentOrmEntity } from '../entities/content-orm.entity';
import { ContentVariantOrmEntity } from '../entities/content-variant-orm.entity';
import { MediaAssetOrmEntity } from '../entities/media-asset-orm.entity';

/**
 * Maps the WHOLE aggregate: content plus variants plus media.
 *
 * `toOrmData` returns the three sets separately because they are three tables, but they are only ever
 * written together — see the repository, which replaces children wholesale so the persisted state can
 * never disagree with `content_hash`.
 */
@Injectable()
export class ContentMapper {
  toDomain(
    orm: ContentOrmEntity,
    variants: readonly ContentVariantOrmEntity[],
    media: readonly MediaAssetOrmEntity[],
  ): Content {
    return Content.reconstitute({
      id: ContentId.from(orm.id),
      accountId: orm.accountId,
      title: orm.title,
      classification: orm.classification,
      origin: orm.origin,
      bodyBase: orm.bodyBase,
      sourceUrl: orm.sourceUrl,
      includeSourceUrl: orm.includeSourceUrl,
      status: orm.status,
      contentHash: orm.contentHash,
      createdBy: orm.createdBy,
      approvedAt: orm.approvedAt,
      createdAt: orm.createdAt,
      variants: variants.map((variant) =>
        ContentVariant.reconstitute({
          id: variant.id,
          label: variant.label,
          body: variant.body,
          position: variant.position,
          createdBy: variant.createdBy,
          reviewedBy: variant.reviewedBy,
        }),
      ),
      media: media.map((asset) =>
        MediaAsset.reconstitute({
          id: asset.id,
          variantId: asset.variantId,
          kind: asset.kind,
          storageKey: asset.storageKey,
          mimeType: asset.mimeType,
          // bigint comes back as a string from pg.
          sizeBytes: Number(asset.sizeBytes),
          originalName: asset.originalName,
        }),
      ),
    });
  }

  toOrmData(content: Content): {
    content: Record<string, unknown>;
    variants: Record<string, unknown>[];
    media: Record<string, unknown>[];
  } {
    return {
      content: {
        id: content.id.value,
        accountId: content.accountId,
        title: content.title,
        classification: content.classification,
        origin: content.origin,
        bodyBase: content.bodyBase,
        sourceUrl: content.sourceUrl,
        includeSourceUrl: content.includeSourceUrl,
        status: content.status,
        contentHash: content.contentHash,
        createdBy: content.createdBy,
        approvedAt: content.approvedAt,
        createdAt: content.createdAt,
      },
      variants: content.variants.map((variant) => ({
        id: variant.id,
        accountId: content.accountId,
        contentId: content.id.value,
        label: variant.label,
        body: variant.body,
        position: variant.position,
        createdBy: variant.createdBy,
        reviewedBy: variant.reviewedBy,
        createdAt: content.createdAt,
      })),
      media: content.media.map((asset) => ({
        id: asset.id,
        accountId: content.accountId,
        contentId: content.id.value,
        variantId: asset.variantId,
        kind: asset.kind,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        originalName: asset.originalName,
        createdAt: content.createdAt,
      })),
    };
  }
}
