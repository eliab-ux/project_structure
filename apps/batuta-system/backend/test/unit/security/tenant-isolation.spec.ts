import { MikroORM } from '@mikro-orm/postgresql';
import { RequestContext } from '@mikro-orm/core';
import { AccountOrmEntity } from '../../../src/infrastructure/persistence/mikro-orm/entities/account-orm.entity';
import { UserOrmEntity } from '../../../src/infrastructure/persistence/mikro-orm/entities/user-orm.entity';
import { PlatformAdminOrmEntity } from '../../../src/infrastructure/persistence/mikro-orm/entities/platform-admin-orm.entity';
import { AuditLogOrmEntity } from '../../../src/infrastructure/persistence/mikro-orm/entities/audit-log-orm.entity';
import { PasswordResetCodeOrmEntity } from '../../../src/infrastructure/persistence/mikro-orm/entities/password-reset-code-orm.entity';
import { AccountAbuseSignalOrmEntity } from '../../../src/infrastructure/persistence/mikro-orm/entities/account-abuse-signal-orm.entity';
import { TENANT_FILTER } from '../../../src/infrastructure/persistence/mikro-orm/entities/tenant-scoped-orm.entity';
import { TenantContextService } from '../../../src/infrastructure/security/tenant-context.service';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_B = '22222222-2222-4222-8222-222222222222';

const ENTITIES = [
  AccountOrmEntity,
  UserOrmEntity,
  PlatformAdminOrmEntity,
  AuditLogOrmEntity,
  PasswordResetCodeOrmEntity,
  AccountAbuseSignalOrmEntity,
];

/**
 * These tests exercise the isolation mechanism itself, without a database: the ORM is initialised
 * with `connect: false`, which still performs full metadata discovery and still evaluates filters.
 *
 * They cover BOTH holes named in BATUTA_SPEC §5, FASE 1 item 4:
 *   1. that the filter exists, is default-on and REFUSES to run unscoped;
 *   2. that concurrent requests do not share the scope (RequestContext fork).
 */
describe('tenant isolation', () => {
  let orm: MikroORM;

  beforeAll(async () => {
    orm = await MikroORM.init({
      dbName: 'batuta_test',
      clientUrl: 'postgresql://user:pass@localhost:5432/batuta_test',
      connect: false,
      entities: ENTITIES,
      discovery: { warnWhenNoEntities: false },
    });
  });

  afterAll(async () => {
    await orm.close(true);
  });

  describe('the tenant filter', () => {
    it.each([
      ['UserOrmEntity', UserOrmEntity],
      ['PasswordResetCodeOrmEntity', PasswordResetCodeOrmEntity],
      ['AccountAbuseSignalOrmEntity', AccountAbuseSignalOrmEntity],
    ])('is inherited and default-on for %s', (_name, entity) => {
      const meta = orm.getMetadata().get(entity.name);
      const filter = meta.filters[TENANT_FILTER];

      expect(filter).toBeDefined();
      // default: true is what makes the isolation mechanical instead of a habit.
      expect(filter.default).toBe(true);
    });

    it('every entity with an accountId property carries the filter', () => {
      const offenders = Object.values(orm.getMetadata().getAll())
        .filter((meta) => !!meta.properties.accountId && meta.className !== 'AuditLogOrmEntity')
        .filter((meta) => !meta.filters[TENANT_FILTER])
        .map((meta) => meta.className);

      // A new business entity that forgets to extend TenantScopedOrmEntity fails here.
      expect(offenders).toEqual([]);
    });

    it('scopes the query to the accountId in force', () => {
      const em = orm.em.fork();
      em.setFilterParams(TENANT_FILTER, { accountId: ACCOUNT_A });

      const meta = orm.getMetadata().get(UserOrmEntity.name);
      const cond = meta.filters[TENANT_FILTER].cond as (args: { accountId: string }) => unknown;

      expect(cond({ accountId: ACCOUNT_A })).toEqual({ accountId: ACCOUNT_A });
    });

    it('REFUSES to build a condition when no tenant scope was established', () => {
      const meta = orm.getMetadata().get(UserOrmEntity.name);
      const cond = meta.filters[TENANT_FILTER].cond as (args: Record<string, unknown>) => unknown;

      // Fail securely: a missing scope must break the query, never widen it to every tenant.
      expect(() => cond({})).toThrow(/accountId/);
      expect(() => cond({ accountId: undefined })).toThrow(/accountId/);
    });

    it('does not apply to accounts or platform_admins, which have no accountId', () => {
      expect(orm.getMetadata().get(AccountOrmEntity.name).filters[TENANT_FILTER]).toBeUndefined();
      expect(
        orm.getMetadata().get(PlatformAdminOrmEntity.name).filters[TENANT_FILTER],
      ).toBeUndefined();
    });
  });

  describe('concurrent requests (RequestContext fork)', () => {
    it('does not leak one account scope into another', async () => {
      const seen: Record<string, string | null> = {};

      // Simulates what the MikroORM middleware does per request: a fork inside a RequestContext.
      const simulateRequest = (label: string, accountId: string, delayMs: number) =>
        new Promise<void>((resolve) => {
          RequestContext.create(orm.em, async () => {
            const context = new TenantContextService(RequestContext.getEntityManager()!);
            context.establish(accountId);

            // Yield control so the other "request" runs in between — this is the interleaving
            // that a sequential test never produces and production produces constantly.
            await new Promise((r) => setTimeout(r, delayMs));

            seen[label] = context.currentAccountId();
            resolve();
          });
        });

      await Promise.all([simulateRequest('A', ACCOUNT_A, 30), simulateRequest('B', ACCOUNT_B, 10)]);

      expect(seen.A).toBe(ACCOUNT_A);
      expect(seen.B).toBe(ACCOUNT_B);
    });

    it('keeps scopes independent across many interleaved requests', async () => {
      const accountIds = Array.from(
        { length: 12 },
        (_, i) => `${String(i + 1).padStart(8, '0')}-1111-4111-8111-111111111111`,
      );

      const results = await Promise.all(
        accountIds.map(
          (accountId, index) =>
            new Promise<string | null>((resolve) => {
              RequestContext.create(orm.em, async () => {
                const context = new TenantContextService(RequestContext.getEntityManager()!);
                context.establish(accountId);
                await new Promise((r) => setTimeout(r, (accountIds.length - index) * 3));
                resolve(context.currentAccountId());
              });
            }),
        ),
      );

      expect(results).toEqual(accountIds);
    });
  });

  describe('TenantContextService', () => {
    it('throws when a scope is required but was never established', () => {
      const em = orm.em.fork();
      const context = new TenantContextService(em);

      expect(() => context.requireAccountId()).toThrow(/Escopo de tenant/);
      expect(context.currentAccountId()).toBeNull();
    });

    it('platform scope deliberately establishes no tenant', () => {
      const em = orm.em.fork();
      const context = new TenantContextService(em);

      context.establishPlatformScope();

      // A platform request that touches a business entity must break, not read everyone's rows.
      expect(context.currentAccountId()).toBeNull();
    });
  });
});
