import { Filter, Index, PrimaryKey, Property } from '@mikro-orm/core';

/** Name of the global tenant filter. Referenced by the guard that feeds its parameters. */
export const TENANT_FILTER = 'tenant';

/**
 * The Postgres session variable that carries the tenant into the database, where the RLS policies
 * read it. Set in ONE place only — `TenantScopeSubscriber` — and always transaction-local.
 */
export const TENANT_GUC = 'app.account_id';

/** Soft-delete filter. Business rows are never physically removed (Visão Geral §3). */
export const NOT_DELETED_FILTER = 'notDeleted';

/**
 * Base of EVERY tenant-scoped ORM entity. Isolation is mechanical here, not a habit.
 *
 * There are TWO independent layers, and the point of writing them both is that neither is trusted
 * to be the only one (Defense in Depth, CLAUDE.md princípio 4):
 *
 *  - **Application:** the `tenant` filter is `default: true`, so it applies to every entity query
 *    without the repository having to remember an `accountId` parameter that someone can forget.
 *    `args` has no fallback: if nobody established the scope, MikroORM throws rather than running
 *    an unscoped query. A missing scope is a 500, never a cross-tenant read.
 *  - **Database:** every one of these tables carries `ENABLE ROW LEVEL SECURITY` and a policy on
 *    `account_id = current_setting('app.account_id')`. Even a query that somehow escapes the filter
 *    — raw SQL, a future ORM bug, a psql session opened with the runtime credentials — returns
 *    nothing outside its tenant.
 *
 * The two known holes in the application layer are handled elsewhere and on purpose: raw SQL does
 * not pass through filters (use `ScopedRawQueryService`), and the EntityManager must be forked per
 * request (`registerRequestContext`). The database layer covers both regardless.
 */
@Filter({
  name: TENANT_FILTER,
  cond: (args: { accountId?: string }) => {
    if (!args?.accountId) {
      throw new Error(
        'Tenant filter usado sem accountId: o escopo do request não foi estabelecido. ' +
          'Nunca alargue isto para uma query sem escopo.',
      );
    }
    return { accountId: args.accountId };
  },
  default: true,
})
@Filter({
  name: NOT_DELETED_FILTER,
  cond: { deletedAt: null },
  default: true,
})
export abstract class TenantScopedOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Index()
  @Property({ type: 'uuid', fieldName: 'account_id' })
  accountId!: string;

  @Property({ type: 'timestamptz', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  /**
   * Soft delete. A deleted row stays readable by the owner role (reports, audits, undelete) and is
   * invisible to the application through the `notDeleted` filter.
   */
  @Property({ type: 'timestamptz', nullable: true, fieldName: 'deleted_at' })
  deletedAt: Date | null = null;
}
