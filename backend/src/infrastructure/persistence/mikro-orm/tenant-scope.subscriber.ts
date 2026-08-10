import { EventSubscriber, TransactionEventArgs } from '@mikro-orm/core';
import type { AbstractSqlConnection } from '@mikro-orm/postgresql';
import { TENANT_FILTER, TENANT_GUC } from './entities/tenant-scoped-orm.entity';

/**
 * The hook that carries the tenant into the database, on every transaction, without anybody having
 * to remember it.
 *
 * The moment a transaction opens it gets `set_config('app.account_id', <id>, true)`, and the RLS
 * policies read exactly that. No use case, repository or controller issues that statement; they
 * only establish the *application* scope (`TenantContextService`), and this translates it into the
 * *database* scope. One point of failure instead of one per query — which is the whole reason this
 * is a subscriber and not a helper somebody has to call.
 *
 * Two details that are the difference between this working and merely looking like it works:
 *
 *  1. **`true` — the GUC is transaction-LOCAL.** With a connection pool, a session-level variable
 *     survives the request and silently scopes whoever borrows that connection next. This is also
 *     why every request runs inside a transaction (`TenantTransactionInterceptor`): outside one
 *     there is no scope, and under RLS no scope reads nothing rather than everything.
 *  2. **No fallback when the scope is absent.** An unscoped transaction sets the GUC to the empty
 *     string, which the policies (`nullif(current_setting(...), '')::uuid`) turn into NULL, matching
 *     no row. Failing closed.
 *
 * MikroORM hands this event the transactional FORK of the EntityManager, and `fork()` copies
 * `filterParams` — which is what makes reading the scope from `args.em` correct here. The statement
 * is issued inline rather than through `applyTenantGuc` because only here is the transaction handle
 * delivered by the event itself, before `getTransactionContext()` would report it.
 */
export class TenantScopeSubscriber implements EventSubscriber {
  async afterTransactionStart(args: TransactionEventArgs): Promise<void> {
    const accountId =
      args.em.getFilterParams<{ accountId?: string }>(TENANT_FILTER)?.accountId ?? '';

    const connection = args.em.getConnection() as unknown as AbstractSqlConnection;
    const ctx = args.transaction ?? args.em.getTransactionContext();

    await connection.execute('select set_config(?, ?, true)', [TENANT_GUC, accountId], 'run', ctx);
  }
}
