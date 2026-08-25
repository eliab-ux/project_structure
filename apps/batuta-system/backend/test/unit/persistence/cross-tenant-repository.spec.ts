import { EntityManager } from '@mikro-orm/core';
import { MikroOrmUserRepository } from '../../../src/infrastructure/persistence/mikro-orm/repositories/user.repository';
import { UserMapper } from '../../../src/infrastructure/persistence/mikro-orm/mappers/user.mapper';
import { TENANT_FILTER } from '../../../src/infrastructure/persistence/mikro-orm/entities/tenant-scoped-orm.entity';
import { UserOrmEntity } from '../../../src/infrastructure/persistence/mikro-orm/entities/user-orm.entity';
import { Email } from '../../../src/contexts/user/domain/value-objects/email.vo';
import { UserId } from '../../../src/contexts/user/domain/value-objects/user-id.vo';
import { UserRole } from '../../../src/contexts/user/domain/value-objects/user-role.vo';
import { UserStatus } from '../../../src/contexts/user/domain/value-objects/user-status.vo';

const USER_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';

function ormRow(accountId = ACCOUNT_A): UserOrmEntity {
  const row = new UserOrmEntity();
  row.id = USER_ID;
  row.accountId = accountId;
  row.name = 'Maria';
  row.email = 'maria@exemplo.com';
  row.passwordHash = 'hash';
  row.role = UserRole.OPERATOR;
  row.status = UserStatus.ACTIVE;
  row.createdAt = new Date();
  return row;
}

/**
 * Cross-tenant isolation, from the repository's side.
 *
 * With no database available these tests assert the mechanism rather than the query result: that
 * the repository never passes an accountId of its own (the global filter does the scoping), and
 * that the ONE method allowed to bypass the filter is the login lookup — and no other.
 *
 * The complementary end-to-end proof ("account A asking for an entity of account B gets 404")
 * needs a live Postgres and lives in test/integration/tenant-isolation.integration.spec.ts.
 */
describe('MikroOrmUserRepository — tenant scoping', () => {
  let em: jest.Mocked<Pick<EntityManager, 'findOne' | 'find' | 'upsert' | 'flush'>>;
  let repository: MikroOrmUserRepository;

  beforeEach(() => {
    em = {
      findOne: jest.fn(),
      find: jest.fn(async () => []),
      upsert: jest.fn(async () => ormRow()),
      flush: jest.fn(),
    } as unknown as jest.Mocked<Pick<EntityManager, 'findOne' | 'find' | 'upsert' | 'flush'>>;
    repository = new MikroOrmUserRepository(em as unknown as EntityManager, new UserMapper());
  });

  it('findById passes NO accountId and NO filter override — the global filter scopes it', async () => {
    em.findOne.mockResolvedValue(ormRow());

    await repository.findById(UserId.from(USER_ID));

    const [, where, options] = em.findOne.mock.calls[0];
    expect(where).toEqual({ id: USER_ID });
    // No accountId parameter to forget, and no `filters: false` to accidentally leave behind.
    expect(JSON.stringify(where)).not.toContain('accountId');
    expect(options?.filters).toBeUndefined();
  });

  it('findByEmail is tenant-scoped: the same e-mail in another account is invisible', async () => {
    em.findOne.mockResolvedValue(null);

    const found = await repository.findByEmail(Email.create('maria@exemplo.com'));

    const [, , options] = em.findOne.mock.calls[0];
    expect(options?.filters).toBeUndefined();
    expect(found).toBeNull();
  });

  it('listByAccount queries with an empty where — scope comes from the filter', async () => {
    await repository.listByAccount();

    const [, where, options] = em.find.mock.calls[0];
    expect(where).toEqual({});
    expect(options?.filters).toBeUndefined();
  });

  it('findByEmailForAuthentication is the ONLY method that disables the filter', async () => {
    em.findOne.mockResolvedValue(ormRow());

    await repository.findByEmailForAuthentication(Email.create('maria@exemplo.com'));

    const [, , options] = em.findOne.mock.calls[0];
    // Unscoped by necessity: at login there is no JWT, therefore no tenant.
    expect(options?.filters).toEqual({ [TENANT_FILTER]: false });
  });

  it('no other repository method disables the filter', async () => {
    em.findOne.mockResolvedValue(ormRow());

    await repository.findById(UserId.from(USER_ID));
    await repository.findByEmail(Email.create('maria@exemplo.com'));
    await repository.listByAccount();

    const overrides = [...em.findOne.mock.calls, ...em.find.mock.calls]
      .map(([, , options]) => options?.filters)
      .filter(Boolean);
    expect(overrides).toEqual([]);
  });

  it('writes always carry the accountId, so a row cannot land in another tenant', async () => {
    const mapper = new UserMapper();
    const domain = mapper.toDomain(ormRow());

    await repository.save(domain);

    const [, data] = em.upsert.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(data.accountId).toBe(ACCOUNT_A);
  });
});
