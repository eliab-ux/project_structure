import { Filter, Index, PrimaryKey, Property } from '@mikro-orm/core';

/** Name of the global tenant filter. Referenced by the guard that feeds its parameters. */
export const TENANT_FILTER = 'tenant';

/**
 * Base of EVERY business ORM entity. Isolation is mechanical here, not a habit:
 *
 *  - `accountId` is `NOT NULL` — there is no such thing as a tenant-less business row;
 *  - the `tenant` filter is `default: true`, so it applies to every entity query without the
 *    repository having to remember an `accountId` parameter that someone can forget;
 *  - `args` has no fallback. If nobody called `em.setFilterParams(TENANT_FILTER, …)`, MikroORM
 *    throws instead of running an unscoped query. Fail securely: a missing tenant scope is a
 *    500, never a cross-tenant read.
 *
 * The two known holes in this design are handled elsewhere and on purpose (BATUTA_SPEC §5,
 * FASE 1 item 4): raw SQL does not pass through filters (use the scoped-raw helper), and the
 * EntityManager must be forked per request (RequestContext).
 */
@Filter({
  name: TENANT_FILTER,
  cond: (args: { accountId?: string }) => {
    if (!args?.accountId) {
      throw new Error(
        `Tenant filter used without accountId. The request scope was not established — ` +
          `never widen this to an unscoped query.`,
      );
    }
    return { accountId: args.accountId };
  },
  default: true,
})
export abstract class TenantScopedOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Index()
  @Property({ type: 'uuid', fieldName: 'account_id' })
  accountId!: string;

  @Property({ fieldName: 'created_at' })
  createdAt: Date = new Date();
}
