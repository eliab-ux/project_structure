import { EntityManager } from '@mikro-orm/core';
import type { AbstractSqlConnection } from '@mikro-orm/postgresql';
import { TENANT_GUC } from './entities/tenant-scoped-orm.entity';

/**
 * The ONE function in the codebase that issues `set_config('app.account_id', …)`.
 *
 * Grep for `set_config` and this is the only hit. Two callers, both central infrastructure, never a
 * use case:
 *
 *  - `TenantScopeSubscriber.afterTransactionStart` — the normal path. Every transaction opens with
 *    the scope of the request that opened it.
 *  - `TenantContextService.establishFromAuthenticatedUser` — the login path, where the tenant is
 *    only discovered mid-transaction (the e-mail is looked up across tenants, and only then is the
 *    account known). Without this second call the GUC would keep the empty value written when the
 *    transaction opened, and every subsequent scoped read would return nothing under RLS.
 *
 * `is_local = true` is not optional: a session-level GUC survives the request and leaks into
 * whoever borrows that pooled connection next. Transaction-local dies at COMMIT/ROLLBACK.
 *
 * When no transaction is open the call is skipped rather than executed. A transaction-local setting
 * outside a transaction would apply to the implicit single-statement transaction and vanish — doing
 * it would look like it worked and change nothing, which is worse than not doing it. That case is
 * the guard, which runs before the request transaction exists; the subscriber picks the scope up
 * moments later.
 */
export async function applyTenantGuc(em: EntityManager, accountId: string): Promise<void> {
  const ctx = em.getTransactionContext();
  if (!ctx) {
    return;
  }

  const connection = em.getConnection() as unknown as AbstractSqlConnection;
  await connection.execute('select set_config(?, ?, true)', [TENANT_GUC, accountId], 'run', ctx);
}
