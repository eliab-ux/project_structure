import { EntityManager } from '@mikro-orm/postgresql';
import { ScopedRawQueryService } from '../../../src/infrastructure/persistence/mikro-orm/scoped-raw-query.service';
import { TenantContextService } from '../../../src/infrastructure/security/tenant-context.service';
import { MissingTenantScopeException } from '../../../src/infrastructure/security/exceptions/missing-tenant-scope.exception';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';

function build(accountId: string | null) {
  const raw = jest.fn(async () => ({ rows: [{ total: '7' }] }));
  const em = { getKnex: () => ({ raw }) } as unknown as EntityManager;
  const tenantContext = {
    requireAccountId: () => {
      if (!accountId) {
        throw new MissingTenantScopeException();
      }
      return accountId;
    },
  } as unknown as TenantContextService;

  return { service: new ScopedRawQueryService(em, tenantContext), raw };
}

/**
 * Guards the first of the two known holes (BATUTA_SPEC §5, FASE 1 item 4): raw SQL does not pass
 * through the global tenant filter, so it must be impossible to write an unscoped raw query
 * without noticing.
 */
describe('ScopedRawQueryService', () => {
  it('injects the accountId from the request scope', async () => {
    const { service, raw } = build(ACCOUNT_A);

    const rows = await service.scoped<{ total: string }>(
      'select count(*) as total from users where account_id = :accountId and status = :status',
      { status: 'ACTIVE' },
    );

    expect(rows).toEqual([{ total: '7' }]);
    expect(raw).toHaveBeenCalledWith(expect.stringContaining(':accountId'), {
      status: 'ACTIVE',
      accountId: ACCOUNT_A,
    });
  });

  it('REFUSES SQL that does not reference :accountId', async () => {
    const { service, raw } = build(ACCOUNT_A);

    // The exact mistake this class exists to prevent.
    await expect(service.scoped('select count(*) from users')).rejects.toThrow(
      /precisa referenciar :accountId/,
    );
    expect(raw).not.toHaveBeenCalled();
  });

  it('REFUSES an accountId supplied by the caller', async () => {
    const { service, raw } = build(ACCOUNT_A);

    // If a caller could pass it, a request could name another tenant.
    await expect(
      service.scoped('select 1 from users where account_id = :accountId', {
        accountId: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toThrow(/não passe accountId/i);
    expect(raw).not.toHaveBeenCalled();
  });

  it('throws when there is no tenant scope, instead of running unscoped', async () => {
    const { service, raw } = build(null);

    await expect(
      service.scoped('select 1 from users where account_id = :accountId'),
    ).rejects.toThrow(MissingTenantScopeException);
    expect(raw).not.toHaveBeenCalled();
  });

  it('platformScoped is a separate, explicitly named door for cross-tenant reads', async () => {
    const { service, raw } = build(null);

    await service.platformScoped('select count(*) as total from accounts');

    // No accountId requirement here — and the awkward name is the point: every call site is
    // expected to be reviewed as a deliberate cross-tenant read behind PlatformAdminGuard.
    expect(raw).toHaveBeenCalledWith('select count(*) as total from accounts', {});
  });

  it('unwraps the pg { rows } shape', async () => {
    const { service } = build(ACCOUNT_A);

    const rows = await service.scoped('select 1 where account_id = :accountId');

    expect(Array.isArray(rows)).toBe(true);
  });
});
