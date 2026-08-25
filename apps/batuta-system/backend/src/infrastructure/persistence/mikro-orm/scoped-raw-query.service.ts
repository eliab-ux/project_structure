import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { TenantContextService } from '../../security/tenant-context.service';

/**
 * The ONLY authorised way to run raw SQL against tenant data.
 *
 * Why it exists (BATUTA_SPEC §5, FASE 1 item 4, furo 1): the global tenant filter applies to
 * entity queries and **not** to `em.getKnex().raw(...)`, which CLAUDE.md explicitly allows for
 * metrics. That is the exact hole through which data leaks between tenants. So:
 *
 *  - `getKnex()` is called in this file and nowhere else — grep for it and this is the only hit;
 *  - the accountId is injected by the service, taken from the request scope, never from a caller
 *    argument that could be spoofed or forgotten;
 *  - the SQL must contain the `:accountId` binding, and the service refuses to run it otherwise.
 *    A query that forgot to scope itself fails loudly instead of returning everyone's rows.
 *
 * Named bindings (`:name`) rather than `?`: with a positional list, adding a column later shifts
 * every parameter and the mistake is silent.
 */
@Injectable()
export class ScopedRawQueryService {
  private readonly logger = new Logger(ScopedRawQueryService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Runs a tenant-scoped raw query. The SQL must reference `:accountId` in its WHERE clause.
   *
   * @example
   * this.raw.scoped<{ total: string }>(
   *   'select count(*) as total from dispatches where account_id = :accountId and status = :status',
   *   { status: 'SENT' },
   * );
   */
  async scoped<T = Record<string, unknown>>(
    sql: string,
    bindings: Record<string, unknown> = {},
  ): Promise<T[]> {
    if (!sql.includes(':accountId')) {
      throw new Error(
        'Raw query sem escopo de tenant: o SQL precisa referenciar :accountId no WHERE. ' +
          'Se a intenção é cruzar contas, use platformScoped() sob PlatformAdminGuard.',
      );
    }
    if ('accountId' in bindings) {
      // The scope is not a caller-supplied value. Silently overriding it would be worse.
      throw new Error('Não passe accountId nos bindings: ele vem do escopo do request.');
    }

    const accountId = this.tenantContext.requireAccountId();
    const knex = this.em.getKnex();
    const result = await knex.raw(sql, { ...bindings, accountId });
    return this.rows<T>(result);
  }

  /**
   * Cross-tenant raw query, for the platform area only. Reachable exclusively from code behind
   * PlatformAdminGuard — every call site is expected to be reviewed as such, which is why it is a
   * separate, deliberately awkward method name instead of a flag on `scoped()`.
   */
  async platformScoped<T = Record<string, unknown>>(
    sql: string,
    bindings: Record<string, unknown> = {},
  ): Promise<T[]> {
    this.logger.debug('Raw query de plataforma (cruza contas)');
    const result = await this.em.getKnex().raw(sql, bindings);
    return this.rows<T>(result);
  }

  /** pg returns `{ rows }`; other drivers return the array directly. */
  private rows<T>(result: unknown): T[] {
    if (result && typeof result === 'object' && 'rows' in result) {
      return (result as { rows: T[] }).rows;
    }
    return (result as T[]) ?? [];
  }
}
