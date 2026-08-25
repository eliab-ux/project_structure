import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PaginatedResult, Pagination } from '@gitspread/shared-kernel';
import {
  ContentRepositoryPort,
  ListContentsFilter,
} from '../../../../contexts/content/application/ports/output/content-repository.port';
import { Content } from '../../../../contexts/content/domain/entities/content.entity';
import { ContentId } from '../../../../contexts/content/domain/value-objects/content-id.vo';
import { ContentOrmEntity } from '../entities/content-orm.entity';
import { ContentVariantOrmEntity } from '../entities/content-variant-orm.entity';
import { MediaAssetOrmEntity } from '../entities/media-asset-orm.entity';
import { ContentMapper } from '../mappers/content.mapper';

/**
 * Loads and saves the whole aggregate.
 *
 * `save` REPLACES the children rather than diffing them: delete the variants and media of this
 * content, then insert what the aggregate currently holds. That is deliberate — a diff would have to
 * track removals, and a missed removal leaves a row that `content_hash` does not account for, which
 * silently breaks the approval invalidation of §8.5. Replacing cannot drift.
 *
 * The cost is bounded: a content has a handful of variants, not thousands.
 *
 * Every read is tenant-scoped by the inherited global filter; no method disables it.
 */
@Injectable()
export class MikroOrmContentRepository implements ContentRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: ContentMapper,
  ) {}

  async findById(id: ContentId): Promise<Content | null> {
    const orm = await this.em.findOne(ContentOrmEntity, { id: id.value });
    if (!orm) {
      return null;
    }

    const [variants, media] = await Promise.all([
      this.em.find(
        ContentVariantOrmEntity,
        { contentId: orm.id },
        { orderBy: { position: 'ASC' } },
      ),
      this.em.find(MediaAssetOrmEntity, { contentId: orm.id }),
    ]);

    return this.mapper.toDomain(orm, variants, media);
  }

  async list(filter: ListContentsFilter): Promise<PaginatedResult<Content>> {
    const params = Pagination.create(filter.page, filter.limit);
    const where: Record<string, unknown> = {};

    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.classification) {
      where.classification = filter.classification;
    }
    if (filter.search?.trim()) {
      where.title = { $ilike: `%${filter.search.trim()}%` };
    }

    const [rows, total] = await this.em.findAndCount(ContentOrmEntity, where, {
      limit: params.limit,
      offset: (params.page - 1) * params.limit,
      orderBy: { createdAt: 'DESC' },
    });

    if (rows.length === 0) {
      return Pagination.createResult<Content>([], total, params);
    }

    // Two queries for the whole page instead of two per content.
    const contentIds = rows.map((row) => row.id);
    const [variants, media] = await Promise.all([
      this.em.find(
        ContentVariantOrmEntity,
        { contentId: { $in: contentIds } },
        { orderBy: { position: 'ASC' } },
      ),
      this.em.find(MediaAssetOrmEntity, { contentId: { $in: contentIds } }),
    ]);

    const variantsByContent = MikroOrmContentRepository.groupBy(variants, (v) => v.contentId);
    const mediaByContent = MikroOrmContentRepository.groupBy(media, (m) => m.contentId);

    return Pagination.createResult(
      rows.map((row) =>
        this.mapper.toDomain(
          row,
          variantsByContent.get(row.id) ?? [],
          mediaByContent.get(row.id) ?? [],
        ),
      ),
      total,
      params,
    );
  }

  async save(content: Content): Promise<Content> {
    const data = this.mapper.toOrmData(content);

    await this.em.upsert(ContentOrmEntity, data.content);

    // Replace the children. Media first: it references variants.
    await this.em.nativeDelete(MediaAssetOrmEntity, { contentId: content.id.value });
    await this.em.nativeDelete(ContentVariantOrmEntity, { contentId: content.id.value });

    if (data.variants.length > 0) {
      await this.em.insertMany(
        ContentVariantOrmEntity,
        data.variants as unknown as ContentVariantOrmEntity[],
      );
    }
    if (data.media.length > 0) {
      await this.em.insertMany(MediaAssetOrmEntity, data.media as unknown as MediaAssetOrmEntity[]);
    }

    await this.em.flush();
    // Returns the aggregate as given: the caller already holds the authoritative in-memory state,
    // and re-reading would cost two queries to learn nothing new.
    return content;
  }

  private static groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const group = map.get(key(item));
      if (group) {
        group.push(item);
      } else {
        map.set(key(item), [item]);
      }
    }
    return map;
  }
}
