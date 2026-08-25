import { EntityManager } from '@mikro-orm/postgresql';
import {
  MikroOrmDispatchRepository,
  MikroOrmDistributionRepository,
} from '../../../src/infrastructure/persistence/mikro-orm/repositories/distribution.repository';
import { ScopedRawQueryService } from '../../../src/infrastructure/persistence/mikro-orm/scoped-raw-query.service';
import { TENANT_FILTER } from '../../../src/infrastructure/persistence/mikro-orm/entities/tenant-scoped-orm.entity';
import { Dispatch } from '../../../src/contexts/distribution/domain/entities/dispatch.entity';
import { BlockedReason } from '../../../src/contexts/distribution/domain/value-objects/dispatch-status.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const DISTRIBUTION_ID = 'eeeeeeee-1111-4111-8111-111111111111';

describe('Distribution repositories — tenant scoping', () => {
  let em: jest.Mocked<
    Pick<
      EntityManager,
      'findOne' | 'find' | 'findAndCount' | 'upsert' | 'flush' | 'insertMany' | 'nativeUpdate'
    >
  >;
  let raw: jest.Mocked<Pick<ScopedRawQueryService, 'scoped'>>;

  beforeEach(() => {
    em = {
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
      findAndCount: jest.fn(async () => [[], 0]),
      upsert: jest.fn(),
      flush: jest.fn(),
      insertMany: jest.fn(),
      nativeUpdate: jest.fn(async () => 0),
    } as unknown as typeof em;
    raw = { scoped: jest.fn(async () => []) } as unknown as typeof raw;
  });

  function dispatchRepository(): MikroOrmDispatchRepository {
    return new MikroOrmDispatchRepository(
      em as unknown as EntityManager,
      raw as unknown as ScopedRawQueryService,
    );
  }

  it('every dispatch read relies on the global filter — none disables it', async () => {
    const repository = dispatchRepository();

    await repository.findById('dddddddd-1111-4111-8111-111111111111');
    await repository.listForDistribution(DISTRIBUTION_ID, { page: 1, limit: 10 });
    await repository.listPendingForChannel('cccccccc-1111-4111-8111-111111111111');

    const overrides = [
      ...em.findOne.mock.calls,
      ...em.find.mock.calls,
      ...em.findAndCount.mock.calls,
    ]
      .map(([, , options]) => (options as { filters?: unknown } | undefined)?.filters)
      .filter(Boolean);
    expect(overrides).toEqual([]);
  });

  it('no dispatch query smuggles an accountId of its own — the filter is the single source of scope', async () => {
    const repository = dispatchRepository();

    await repository.findById('dddddddd-1111-4111-8111-111111111111');
    await repository.listForDistribution(DISTRIBUTION_ID, { page: 1, limit: 10 });
    await repository.cancelPendingFor(DISTRIBUTION_ID);

    const wheres = [
      ...em.findOne.mock.calls,
      ...em.findAndCount.mock.calls,
      ...em.nativeUpdate.mock.calls,
    ]
      .map(([, where]) => JSON.stringify(where))
      .join('|');
    expect(wheres).not.toContain('accountId');
  });

  it('the three aggregate reads go through the scoped raw service, which requires :accountId', async () => {
    const repository = dispatchRepository();

    await repository.countsFor(DISTRIBUTION_ID);
    await repository.byChannelFor(DISTRIBUTION_ID);
    await repository.blockedSummaryFor(DISTRIBUTION_ID);

    expect(raw.scoped).toHaveBeenCalledTimes(3);
    for (const [sql, bindings] of raw.scoped.mock.calls) {
      // The service itself refuses SQL without this, but asserting it here documents the contract at
      // the call site — and catches a future edit that "simplifies" the WHERE clause away.
      expect(sql).toContain(':accountId');
      // The accountId is NEVER a binding: it comes from the request scope.
      expect(bindings).not.toHaveProperty('accountId');
    }
  });

  it('o próximo envio pendente sai de uma leitura escopada, só de PENDING', async () => {
    const repository = dispatchRepository();
    const due = new Date('2026-08-08T11:00:00Z');
    raw.scoped.mockResolvedValueOnce([{ next_at: due }]);

    const next = await repository.nextPendingAt(DISTRIBUTION_ID);

    const [sql] = raw.scoped.mock.calls[0] as [string];
    expect(sql).toContain(':accountId');
    // Só PENDING: o mínimo sobre todas as linhas devolveria o horário de um envio que já saiu, e a
    // tela diria "próximo envio" apontando para o passado.
    expect(sql).toContain("status = 'PENDING'");
    expect(next).toEqual(due);
  });

  it('devolve null quando nada está pendente, em vez de uma data inventada', async () => {
    const repository = dispatchRepository();
    raw.scoped.mockResolvedValueOnce([{ next_at: null }]);

    expect(await repository.nextPendingAt(DISTRIBUTION_ID)).toBeNull();
  });

  it('cancelling never touches SENT rows — that is the point of cancelling rather than deleting', async () => {
    const repository = dispatchRepository();

    await repository.cancelPendingFor(DISTRIBUTION_ID);

    const [, where] = em.nativeUpdate.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
    ];
    const statuses = JSON.stringify(where);
    expect(statuses).toContain('PENDING');
    expect(statuses).not.toContain('SENT');
  });

  it('blocking a dead channel only touches PENDING rows', async () => {
    const repository = dispatchRepository();

    await repository.blockPendingForChannel(
      'cccccccc-1111-4111-8111-111111111111',
      BlockedReason.SENDER_UNAVAILABLE,
    );

    const [, where, data] = em.nativeUpdate.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(where.status).toBe('PENDING');
    expect(data.blockedReason).toBe(BlockedReason.SENDER_UNAVAILABLE);
  });

  it('writes carry the accountId, so a row cannot land in another tenant', async () => {
    const repository = dispatchRepository();
    const dispatch = Dispatch.schedule({
      accountId: ACCOUNT_ID,
      distributionId: DISTRIBUTION_ID,
      contactId: 'ffffffff-1111-4111-8111-111111111111',
      channelId: 'cccccccc-1111-4111-8111-111111111111',
      variantId: null,
      renderedBody: 'Olá Maria',
      scheduledAt: new Date(),
    });

    await repository.saveMany([dispatch]);

    const [, rows] = em.insertMany.mock.calls[0] as unknown as [unknown, Record<string, unknown>[]];
    expect(rows[0].accountId).toBe(ACCOUNT_ID);
  });

  it('only the cron sweep of distributions crosses tenants, and it returns ids alone', async () => {
    const repository = new MikroOrmDistributionRepository(em as unknown as EntityManager);

    await repository.findById(DISTRIBUTION_ID);
    await repository.list({ page: 1, limit: 10 });
    await repository.listActiveIds();

    const scopedCalls = [...em.findOne.mock.calls, ...em.findAndCount.mock.calls].map(
      ([, , options]) => (options as { filters?: unknown } | undefined)?.filters,
    );
    expect(scopedCalls.filter(Boolean)).toEqual([]);

    const [, , sweepOptions] = em.find.mock.calls[0] as unknown as [
      unknown,
      unknown,
      { filters?: Record<string, boolean>; fields?: string[] },
    ];
    expect(sweepOptions.filters).toEqual({ [TENANT_FILTER]: false });
    // Ids only: the job re-reads each distribution through the scoped findById afterwards.
    expect(sweepOptions.fields).toEqual(['id', 'accountId']);
  });
});
