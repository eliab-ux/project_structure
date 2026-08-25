import { config as loadEnv } from 'dotenv';
import { MikroORM, RequestContext } from '@mikro-orm/postgresql';
import { randomUUID } from 'crypto';
import { AccountOrmEntity } from '../../src/infrastructure/persistence/mikro-orm/entities/account-orm.entity';
import { UserOrmEntity } from '../../src/infrastructure/persistence/mikro-orm/entities/user-orm.entity';
import { PlatformAdminOrmEntity } from '../../src/infrastructure/persistence/mikro-orm/entities/platform-admin-orm.entity';
import { AuditLogOrmEntity } from '../../src/infrastructure/persistence/mikro-orm/entities/audit-log-orm.entity';
import { PasswordResetCodeOrmEntity } from '../../src/infrastructure/persistence/mikro-orm/entities/password-reset-code-orm.entity';
import { AccountAbuseSignalOrmEntity } from '../../src/infrastructure/persistence/mikro-orm/entities/account-abuse-signal-orm.entity';
import { TENANT_FILTER } from '../../src/infrastructure/persistence/mikro-orm/entities/tenant-scoped-orm.entity';
import { UserMapper } from '../../src/infrastructure/persistence/mikro-orm/mappers/user.mapper';
import { MikroOrmUserRepository } from '../../src/infrastructure/persistence/mikro-orm/repositories/user.repository';
import { AccountPlan } from '../../src/contexts/account/domain/value-objects/account-plan.vo';
import { AccountStatus } from '../../src/contexts/account/domain/value-objects/account-status.vo';
import { UserRole } from '../../src/contexts/user/domain/value-objects/user-role.vo';
import { UserStatus } from '../../src/contexts/user/domain/value-objects/user-status.vo';
import { Email } from '../../src/contexts/user/domain/value-objects/email.vo';
import { UserId } from '../../src/contexts/user/domain/value-objects/user-id.vo';

/**
 * The end-to-end half of the cross-tenant proof: a real database, real SQL, real filter.
 *
 * Runs only when TEST_DATABASE_URL points at a throwaway Postgres — it creates and drops its own
 * schema. Without it the suite skips, so the default `npm test` needs no infrastructure. To run:
 *
 *   TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/batuta_test npm test
 *
 * BATUTA_SPEC §13 asks for this test per repository; this file is the pattern to copy as each
 * phase adds one.
 */
// Loaded HERE and not in the global test setup on purpose: putting it in `test/setup.ts` leaks the
// developer's `.env` into every unit test, and ConfigService prefers `process.env` over the values a
// test passes it — which silently rewrote what two suites were asserting. Only integration needs it.
loadEnv({ override: false });

const DATABASE_URL = process.env.TEST_DATABASE_URL;
const describeWithDb = DATABASE_URL ? describe : describe.skip;

describeWithDb('cross-tenant isolation (needs TEST_DATABASE_URL)', () => {
  let orm: MikroORM;
  const accountA = randomUUID();
  const accountB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();

  beforeAll(async () => {
    orm = await MikroORM.init({
      clientUrl: DATABASE_URL,
      entities: [
        AccountOrmEntity,
        UserOrmEntity,
        PlatformAdminOrmEntity,
        AuditLogOrmEntity,
        PasswordResetCodeOrmEntity,
        AccountAbuseSignalOrmEntity,
      ],
      pool: { min: 0, max: 5 },
      forceUtcTimezone: true,
    });

    await orm.getSchemaGenerator().refreshDatabase();

    // Two tenants, one user each, same e-mail on purpose: uniqueness is per account.
    const em = orm.em.fork();
    for (const [accountId, userId] of [
      [accountA, userA],
      [accountB, userB],
    ]) {
      await em.insert(AccountOrmEntity, {
        id: accountId,
        name: `Conta ${accountId.slice(0, 8)}`,
        document: accountId.replace(/\D/g, '').padEnd(14, '1').slice(0, 14),
        plan: AccountPlan.STANDARD,
        status: AccountStatus.ACTIVE,
        dailySendCeiling: 500,
        timezone: 'America/Sao_Paulo',
        createdAt: new Date(),
      });
      await em.insert(UserOrmEntity, {
        id: userId,
        accountId,
        name: 'Maria',
        email: 'maria@exemplo.com',
        passwordHash: 'hash',
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
      });
    }
  }, 60_000);

  afterAll(async () => {
    if (orm) {
      await orm.getSchemaGenerator().dropSchema();
      await orm.close(true);
    }
  });

  function repositoryScopedTo(accountId: string): {
    repository: MikroOrmUserRepository;
    run: <T>(work: () => Promise<T>) => Promise<T>;
  } {
    const run = <T>(work: () => Promise<T>): Promise<T> =>
      RequestContext.create(orm.em, async () => {
        const em = RequestContext.getEntityManager()!;
        em.setFilterParams(TENANT_FILTER, { accountId });
        return work();
      }) as Promise<T>;

    // The repository resolves the request-scoped EM, exactly as Nest would inject it.
    const repository = new MikroOrmUserRepository(orm.em, new UserMapper());
    return { repository, run };
  }

  it('account A reading its OWN user finds it', async () => {
    const { repository, run } = repositoryScopedTo(accountA);

    const found = await run(() => repository.findById(UserId.from(userA)));

    expect(found?.id.value).toBe(userA);
  });

  it("account A reading account B's user gets NOTHING (→ 404, never 403)", async () => {
    const { repository, run } = repositoryScopedTo(accountA);

    const found = await run(() => repository.findById(UserId.from(userB)));

    // Not found, not forbidden: a 403 would confirm the id exists somewhere else.
    expect(found).toBeNull();
  });

  it('the same e-mail resolves to a different user per tenant', async () => {
    const a = repositoryScopedTo(accountA);
    const b = repositoryScopedTo(accountB);

    const fromA = await a.run(() => a.repository.findByEmail(Email.create('maria@exemplo.com')));
    const fromB = await b.run(() => b.repository.findByEmail(Email.create('maria@exemplo.com')));

    expect(fromA?.id.value).toBe(userA);
    expect(fromB?.id.value).toBe(userB);
  });

  it("listing users returns only the tenant's own", async () => {
    const { repository, run } = repositoryScopedTo(accountA);

    const users = await run(() => repository.listByAccount());

    expect(users.map((u) => u.id.value)).toEqual([userA]);
  });

  it('a query with NO tenant scope throws instead of returning every tenant', async () => {
    const repository = new MikroOrmUserRepository(orm.em, new UserMapper());

    // Fails closed, which is the whole requirement. Note WHERE it fails: MikroORM refuses a
    // default-on filter that has no arguments before it ever calls our `cond`, so the message is its
    // own ("No arguments provided for filter 'tenant'") and not the one the filter would produce.
    // Asserting on our message would be asserting on the weaker of the two guards — this asserts on
    // the observable contract instead: no scope, no rows, an exception.
    await expect(RequestContext.create(orm.em, () => repository.listByAccount())).rejects.toThrow(
      /filter 'tenant'|accountId/,
    );
  });

  it('the login lookup crosses tenants by design, and reports which tenant it found', async () => {
    const repository = new MikroOrmUserRepository(orm.em, new UserMapper());

    const found = await RequestContext.create(orm.em, () =>
      repository.findByEmailForAuthentication(Email.create('maria@exemplo.com')),
    );

    // It resolves without any scope — and the accountId it returns is what scopes everything after.
    expect(found).not.toBeNull();
    expect([accountA, accountB]).toContain(found!.accountId);
  });
});
