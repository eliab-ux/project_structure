import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { TENANT_FILTER } from '../persistence/mikro-orm/entities/tenant-scoped-orm.entity';
import { applyTenantGuc } from '../persistence/mikro-orm/apply-tenant-guc';
import { MissingTenantScopeException } from './exceptions/missing-tenant-scope.exception';

/**
 * Establishes the tenant scope of the current request.
 *
 * How the isolation works, end to end:
 *
 *  1. `@mikro-orm/nestjs` wraps every request in a `RequestContext`, which FORKS the EntityManager.
 *     That fork is what makes this safe under concurrency: `setFilterParams` touches only the
 *     current request's EM, never a shared one. Without the fork, two simultaneous requests would
 *     overwrite each other's accountId — the bug that never shows up in a sequential test.
 *  2. `JwtAuthGuard` calls `establish()` with the accountId taken from the JWT — and nowhere else.
 *  3. `TenantTransactionInterceptor` opens a transaction; `TenantScopeSubscriber` turns the scope
 *     into `set_config('app.account_id', …, true)`, and the RLS policies enforce it.
 *  4. Every tenant entity inherits a `default: true` filter, so entity queries are scoped without
 *     the repository taking an accountId parameter.
 */
@Injectable()
export class TenantContextService {
  private readonly logger = new Logger(TenantContextService.name);

  constructor(private readonly em: EntityManager) {}

  /**
   * Called by JwtAuthGuard once per request, with the accountId from the token.
   *
   * Synchronous, and it only sets the application-side scope: guards run BEFORE the request
   * transaction exists, so there is nothing to write the GUC into yet. The subscriber applies it
   * when the interceptor opens the transaction moments later.
   */
  establish(accountId: string): void {
    this.em.setFilterParams(TENANT_FILTER, { accountId });
  }

  /**
   * Establishes the scope from a user just identified by credentials — login and password reset,
   * where there is no JWT and the tenant is only known after the cross-tenant e-mail lookup.
   *
   * Asynchronous because by this point the request transaction is already open with an EMPTY scope
   * (nobody knew the tenant when it started), so the GUC has to be re-applied for the remainder of
   * it. Skipping that would leave every subsequent scoped read returning nothing under RLS — the
   * kind of failure that looks like a data bug and is actually a scoping one.
   *
   * These are the only two call sites in the system that scope a request from something other than
   * a token, which is why they have a name of their own and are greppable.
   */
  async establishFromAuthenticatedUser(accountId: string): Promise<void> {
    this.em.setFilterParams(TENANT_FILTER, { accountId });
    await applyTenantGuc(this.em, accountId);
  }

  /**
   * Operator scope: the CLI and migrations, which legitimately act across tenants and connect as
   * the owner role. The filter params are deliberately NOT set, so any accidental query against a
   * tenant entity throws instead of returning every tenant's rows.
   */
  establishOperatorScope(): void {
    this.logger.debug('Execução sob escopo de operador — sem tenant');
  }

  /** The accountId in force, or throws. Used where a scope is required to proceed. */
  requireAccountId(): string {
    const params = this.em.getFilterParams<{ accountId?: string }>(TENANT_FILTER);
    if (!params?.accountId) {
      throw new MissingTenantScopeException();
    }
    return params.accountId;
  }

  currentAccountId(): string | null {
    return this.em.getFilterParams<{ accountId?: string }>(TENANT_FILTER)?.accountId ?? null;
  }
}
