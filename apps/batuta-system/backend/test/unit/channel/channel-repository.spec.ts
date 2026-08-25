import { EntityManager } from '@mikro-orm/core';
import { MikroOrmChannelRepository } from '../../../src/infrastructure/persistence/mikro-orm/repositories/channel.repository';
import { ChannelMapper } from '../../../src/infrastructure/persistence/mikro-orm/mappers/channel.mapper';
import { ScopedRawQueryService } from '../../../src/infrastructure/persistence/mikro-orm/scoped-raw-query.service';
import { ChannelOrmEntity } from '../../../src/infrastructure/persistence/mikro-orm/entities/channel-orm.entity';
import { TENANT_FILTER } from '../../../src/infrastructure/persistence/mikro-orm/entities/tenant-scoped-orm.entity';
import { ChannelId } from '../../../src/contexts/channel/domain/value-objects/channel-id.vo';
import { ChannelStatus } from '../../../src/contexts/channel/domain/value-objects/channel-status.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const CHANNEL_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

function ormRow(): ChannelOrmEntity {
  const row = new ChannelOrmEntity();
  row.id = CHANNEL_ID;
  row.accountId = ACCOUNT_A;
  row.label = 'Chip';
  row.phoneE164 = '+5511999998888';
  row.evolutionInstanceName = `acct-${ACCOUNT_A}-ch-${CHANNEL_ID}`;
  row.status = ChannelStatus.CONNECTED;
  row.currentQuota = 20;
  row.quotaFloor = 20;
  row.quotaCeiling = 150;
  row.consecutiveFailures = 0;
  row.disconnectEventsToday = 0;
  row.createdAt = new Date();
  return row;
}

/**
 * Cross-tenant isolation for the channel repository — BATUTA_SPEC §13 asks for this per repository.
 *
 * As with the user repository, it asserts the MECHANISM: that the repository passes no accountId of
 * its own (the global filter scopes it) and never disables the filter — except in the one job-scope
 * method, which is named, documented and pinned here.
 */
describe('MikroOrmChannelRepository — tenant scoping', () => {
  let em: jest.Mocked<Pick<EntityManager, 'findOne' | 'find' | 'upsert' | 'flush'>>;
  let repository: MikroOrmChannelRepository;
  /** Só `scoped` é usado por este repositório, e o teste checa o SQL que passa por ele. */
  let raw: { scoped: jest.Mock };

  beforeEach(() => {
    em = {
      findOne: jest.fn(async () => ormRow()),
      find: jest.fn(async () => [ormRow()]),
      upsert: jest.fn(async () => ormRow()),
      flush: jest.fn(),
    } as unknown as jest.Mocked<Pick<EntityManager, 'findOne' | 'find' | 'upsert' | 'flush'>>;
    raw = { scoped: jest.fn(async () => []) };
    repository = new MikroOrmChannelRepository(
      em as unknown as EntityManager,
      new ChannelMapper(),
      raw as unknown as ScopedRawQueryService,
    );
  });

  it('findById passes NO accountId and NO filter override', async () => {
    await repository.findById(ChannelId.from(CHANNEL_ID));

    const [, where, options] = em.findOne.mock.calls[0];
    expect(where).toEqual({ id: CHANNEL_ID });
    expect(JSON.stringify(where)).not.toContain('accountId');
    expect(options?.filters).toBeUndefined();
  });

  it('findByPhone is tenant-scoped: the same chip number in another account is invisible', async () => {
    await repository.findByPhone(PhoneE164.create('11999998888'));

    const [, where, options] = em.findOne.mock.calls[0];
    expect(where).toEqual({ phoneE164: '+5511999998888' });
    expect(options?.filters).toBeUndefined();
  });

  it('listByAccount and listConnected rely on the filter, not on an argument', async () => {
    await repository.listByAccount();
    await repository.listByAccount(ChannelStatus.DEGRADED);
    await repository.listConnected();

    const wheres = em.find.mock.calls.map(([, where]) => where);
    expect(wheres[0]).toEqual({});
    expect(wheres[1]).toEqual({ status: ChannelStatus.DEGRADED });
    expect(wheres[2]).toEqual({ status: ChannelStatus.CONNECTED });
    expect(em.find.mock.calls.every(([, , options]) => options?.filters === undefined)).toBe(true);
  });

  it('listAllForDailyReview is the ONLY method that disables the filter', async () => {
    await repository.findById(ChannelId.from(CHANNEL_ID));
    await repository.listByAccount();
    await repository.listConnected();
    await repository.listAllForDailyReview();

    const overrides = [...em.findOne.mock.calls, ...em.find.mock.calls]
      .map(([, , options]) => options?.filters)
      .filter(Boolean);

    // Exactly one unscoped read in the whole repository, and it is the cron's.
    expect(overrides).toEqual([{ [TENANT_FILTER]: false }]);
  });

  it('the job-scope read returns identities only, never aggregates', async () => {
    const targets = await repository.listAllForDailyReview();

    const [, , options] = em.find.mock.calls[0];
    // Keeping the unscoped surface as small as possible: two ids, no business data.
    expect(options?.fields).toEqual(['id', 'accountId']);
    expect(targets).toEqual([{ channelId: CHANNEL_ID, accountId: ACCOUNT_A }]);
  });

  it('the job-scope read excludes terminal channels', async () => {
    await repository.listAllForDailyReview();

    const [, where] = em.find.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(where.status).toEqual({ $nin: [ChannelStatus.BANNED, ChannelStatus.RETIRED] });
  });

  it('writes always carry the accountId, so a row cannot land in another tenant', async () => {
    const mapper = new ChannelMapper();
    const domain = mapper.toDomain(ormRow());

    await repository.save(domain);

    const [, data] = em.upsert.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.accountId).toBe(ACCOUNT_A);
    expect(data.evolutionInstanceName).toBe(`acct-${ACCOUNT_A}-ch-${CHANNEL_ID}`);
  });

  it('a reserva de slot é escopada por tenant e atômica em um UPDATE condicional', async () => {
    raw.scoped.mockResolvedValueOnce([{ id: CHANNEL_ID }]);

    const slot = await repository.reserveSendSlot({
      channelId: CHANNEL_ID,
      minIntervalSeconds: 45,
    });

    const [sql] = raw.scoped.mock.calls[0] as [string];
    expect(sql).toContain(':accountId');
    // Um único UPDATE condicional é o mecanismo inteiro de concorrência: dois workers disputam a
    // mesma linha, o perdedor relê a versão nova e o WHERE deixa de casar.
    expect(sql).toContain('update "channels"');
    expect(sql).toContain('"last_send_at" is null');
    expect(sql).toContain('returning "id"');
    expect(slot).toEqual({ allowed: true, waitMs: 0 });
  });

  it('recusada, devolve o que falta do intervalo em vez do intervalo inteiro', async () => {
    raw.scoped.mockResolvedValueOnce([]).mockResolvedValueOnce([{ wait_ms: '15000' }]);

    const slot = await repository.reserveSendSlot({
      channelId: CHANNEL_ID,
      minIntervalSeconds: 45,
    });

    // bigint volta como string do pg; sem a coerção o reagendamento seria por concatenação.
    expect(slot).toEqual({ allowed: false, waitMs: 15000 });
  });

  it('round-trips a channel through the mapper without losing state', async () => {
    const mapper = new ChannelMapper();
    const row = ormRow();
    row.status = ChannelStatus.DEGRADED;
    row.consecutiveFailures = 4;
    row.disconnectEventsToday = 2;
    row.terminalReason = null;

    const domain = mapper.toDomain(row);
    const back = mapper.toOrmData(domain);

    expect(back).toMatchObject({
      id: row.id,
      accountId: row.accountId,
      status: ChannelStatus.DEGRADED,
      consecutiveFailures: 4,
      disconnectEventsToday: 2,
      currentQuota: row.currentQuota,
      quotaFloor: row.quotaFloor,
      quotaCeiling: row.quotaCeiling,
      phoneE164: row.phoneE164,
    });
  });
});
