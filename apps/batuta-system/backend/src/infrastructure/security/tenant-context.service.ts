import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { TENANT_FILTER } from '../persistence/mikro-orm/entities/tenant-scoped-orm.entity';
import { MissingTenantScopeException } from './exceptions/missing-tenant-scope.exception';

/**
 * Establishes the tenant scope of the current request.
 *
 * How the isolation actually works, end to end:
 *
 *  1. `@mikro-orm/nestjs` registers a middleware that wraps every request in a
 *     `RequestContext`, which FORKS the EntityManager. That fork is what makes this safe under
 *     concurrency: `setFilterParams` here touches only the current request's EM, never a shared
 *     one. Without the fork, two simultaneous requests would overwrite each other's accountId —
 *     the bug that never shows up in a sequential test (§5, FASE 1 item 4, furo 2).
 *  2. The guard calls `establish()` with the accountId taken from the JWT — and from nowhere else.
 *  3. Every business entity inherits a `default: true` tenant filter, so every entity query is
 *     scoped without the repository taking an accountId parameter.
 *
 * `em` is injected as the request-scoped fork by Nest+MikroORM, so reading `this.em` inside a
 * request already gives the forked instance.
 */
@Injectable()
export class TenantContextService {
  private readonly logger = new Logger(TenantContextService.name);

  constructor(private readonly em: EntityManager) {}

  /** Called by JwtAuthGuard once per request, with the accountId from the token. */
  establish(accountId: string): void {
    this.em.setFilterParams(TENANT_FILTER, { accountId });
  }

  /**
   * Platform requests have no tenant. The filter params are deliberately NOT set, so any
   * accidental query against a business entity throws instead of returning every tenant's rows.
   */
  establishPlatformScope(): void {
    this.logger.debug('Request sob escopo de plataforma — sem tenant');
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
