import { EntityManager } from '@mikro-orm/core';
import { MikroOrmContentRepository } from '../../../src/infrastructure/persistence/mikro-orm/repositories/content.repository';
import { ContentMapper } from '../../../src/infrastructure/persistence/mikro-orm/mappers/content.mapper';
import { ContentOrmEntity } from '../../../src/infrastructure/persistence/mikro-orm/entities/content-orm.entity';
import { ContentVariantOrmEntity } from '../../../src/infrastructure/persistence/mikro-orm/entities/content-variant-orm.entity';
import { MediaAssetOrmEntity } from '../../../src/infrastructure/persistence/mikro-orm/entities/media-asset-orm.entity';
import { ContentId } from '../../../src/contexts/content/domain/value-objects/content-id.vo';
import { ContentClassification } from '../../../src/contexts/content/domain/value-objects/content-classification.vo';
import { ContentOrigin } from '../../../src/contexts/content/domain/value-objects/content-origin.vo';
import { ContentStatus } from '../../../src/contexts/content/domain/value-objects/content-status.vo';
import { MediaKind } from '../../../src/contexts/content/domain/value-objects/media-kind.vo';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const CONTENT_ID = 'bbbbbbbb-1111-4111-8111-111111111111';
const VARIANT_ID = 'cccccccc-1111-4111-8111-111111111111';
const USER_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

function contentRow(): ContentOrmEntity {
  const row = new ContentOrmEntity();
  row.id = CONTENT_ID;
  row.accountId = ACCOUNT_A;
  row.title = 'Aviso';
  row.classification = ContentClassification.INSTITUTIONAL;
  row.origin = ContentOrigin.MANUAL;
  row.bodyBase = 'Olá {{primeiro_nome|amigo}}';
  row.sourceUrl = null;
  row.status = ContentStatus.DRAFT;
  row.contentHash = 'a'.repeat(64);
  row.createdBy = USER_ID;
  row.approvedAt = null;
  row.createdAt = new Date();
  return row;
}

function variantRow(): ContentVariantOrmEntity {
  const row = new ContentVariantOrmEntity();
  row.id = VARIANT_ID;
  row.accountId = ACCOUNT_A;
  row.contentId = CONTENT_ID;
  row.label = 'Zona Sul';
  row.body = 'Oi {{primeiro_nome|vizinho}}';
  row.position = 0;
  row.createdBy = USER_ID;
  row.reviewedBy = null;
  row.createdAt = new Date();
  return row;
}

function mediaRow(): MediaAssetOrmEntity {
  const row = new MediaAssetOrmEntity();
  row.id = 'dddddddd-1111-4111-8111-111111111111';
  row.accountId = ACCOUNT_A;
  row.contentId = CONTENT_ID;
  row.variantId = null;
  row.kind = MediaKind.IMAGE;
  row.storageKey = 'contents/x/y.jpg';
  row.mimeType = 'image/jpeg';
  // pg returns bigint as a string — the mapper must cope.
  row.sizeBytes = '2048' as unknown as number;
  row.originalName = 'foto.jpg';
  row.createdAt = new Date();
  return row;
}

/** Cross-tenant isolation for the content repository — §13 asks for one per repository. */
describe('MikroOrmContentRepository — tenant scoping', () => {
  let em: jest.Mocked<
    Pick<
      EntityManager,
      'findOne' | 'find' | 'findAndCount' | 'upsert' | 'insertMany' | 'nativeDelete' | 'flush'
    >
  >;
  let repository: MikroOrmContentRepository;

  beforeEach(() => {
    em = {
      findOne: jest.fn(async () => contentRow()),
      find: jest.fn(async (entity: unknown) =>
        entity === ContentVariantOrmEntity ? [variantRow()] : [mediaRow()],
      ),
      findAndCount: jest.fn(async () => [[contentRow()], 1]),
      upsert: jest.fn(async () => contentRow()),
      insertMany: jest.fn(async () => []),
      nativeDelete: jest.fn(async () => 1),
      flush: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<
        EntityManager,
        'findOne' | 'find' | 'findAndCount' | 'upsert' | 'insertMany' | 'nativeDelete' | 'flush'
      >
    >;
    repository = new MikroOrmContentRepository(em as unknown as EntityManager, new ContentMapper());
  });

  it('findById passes NO accountId and NO filter override', async () => {
    await repository.findById(ContentId.from(CONTENT_ID));

    const [, where, options] = em.findOne.mock.calls[0];
    expect(where).toEqual({ id: CONTENT_ID });
    expect(JSON.stringify(where)).not.toContain('accountId');
    expect(options?.filters).toBeUndefined();
  });

  it('NO method anywhere disables the tenant filter', async () => {
    await repository.findById(ContentId.from(CONTENT_ID));
    await repository.list({ page: 1, limit: 10 });

    const overrides = [
      ...em.findOne.mock.calls,
      ...em.find.mock.calls,
      ...em.findAndCount.mock.calls,
    ]
      .map(([, , options]) => options?.filters)
      .filter(Boolean);
    expect(overrides).toEqual([]);
  });

  it('loads the whole aggregate: content plus variants plus media', async () => {
    const content = await repository.findById(ContentId.from(CONTENT_ID));

    expect(content?.variants).toHaveLength(1);
    expect(content?.media).toHaveLength(1);
    expect(content?.variants[0].label).toBe('Zona Sul');
  });

  it('coerces bigint size back to a number', async () => {
    const content = await repository.findById(ContentId.from(CONTENT_ID));

    expect(content?.media[0].sizeBytes).toBe(2048);
    expect(typeof content?.media[0].sizeBytes).toBe('number');
  });

  it('writes carry the accountId on the content AND on every child', async () => {
    const mapper = new ContentMapper();
    const content = mapper.toDomain(contentRow(), [variantRow()], [mediaRow()]);

    await repository.save(content);

    const [, contentData] = em.upsert.mock.calls[0] as [unknown, Record<string, unknown>];
    const inserted = em.insertMany.mock.calls.map(
      ([, rows]) => rows as unknown as Record<string, unknown>[],
    );
    expect(contentData.accountId).toBe(ACCOUNT_A);
    expect(inserted.every((rows) => rows.every((row) => row.accountId === ACCOUNT_A))).toBe(true);
  });

  it('replaces children wholesale so the hash can never describe stale rows', async () => {
    const mapper = new ContentMapper();
    const content = mapper.toDomain(contentRow(), [variantRow()], [mediaRow()]);

    await repository.save(content);

    // Media deleted before variants: media references variants.
    const deleted = em.nativeDelete.mock.calls.map(([entity]) => entity);
    expect(deleted[0]).toBe(MediaAssetOrmEntity);
    expect(deleted[1]).toBe(ContentVariantOrmEntity);
    expect(em.nativeDelete).toHaveBeenCalledWith(
      MediaAssetOrmEntity,
      expect.objectContaining({ contentId: CONTENT_ID }),
    );
  });

  it('a list page loads children in two queries, not two per content', async () => {
    await repository.list({ page: 1, limit: 10 });

    // One for variants, one for media, both with an $in over the page.
    expect(em.find).toHaveBeenCalledTimes(2);
    const [, variantWhere] = em.find.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(variantWhere.contentId).toEqual({ $in: [CONTENT_ID] });
  });

  it('an empty page skips the child queries entirely', async () => {
    em.findAndCount.mockResolvedValue([[], 0]);

    const page = await repository.list({ page: 1, limit: 10 });

    expect(page.data).toEqual([]);
    expect(em.find).not.toHaveBeenCalled();
  });

  it('round-trips the aggregate through the mapper without losing state', () => {
    const mapper = new ContentMapper();
    const row = contentRow();
    row.status = ContentStatus.APPROVED;
    row.approvedAt = new Date('2026-08-01T10:00:00Z');

    const back = mapper.toOrmData(mapper.toDomain(row, [variantRow()], [mediaRow()]));

    expect(back.content).toMatchObject({
      id: row.id,
      accountId: row.accountId,
      classification: ContentClassification.INSTITUTIONAL,
      status: ContentStatus.APPROVED,
      contentHash: row.contentHash,
      approvedAt: row.approvedAt,
    });
    expect(back.variants[0]).toMatchObject({ label: 'Zona Sul', position: 0 });
    expect(back.media[0]).toMatchObject({ storageKey: 'contents/x/y.jpg', sizeBytes: 2048 });
  });
});
