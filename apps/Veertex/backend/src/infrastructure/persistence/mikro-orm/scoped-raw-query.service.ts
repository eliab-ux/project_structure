import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { TenantContextService } from '../../security/tenant-context.service';

/**
 * The ONLY authorised way to run raw SQL against tenant data.
 *
 * Why it exists: the global tenant filter applies to entity queries and **not** to
 * `em.getKnex().raw(...)`, which CLAUDE.md explicitly allows for metrics. RLS does cover raw SQL,
 * so a forgotten `account_id` here returns nothing rather than everything — but "returns nothing"
 * is a silent wrong answer on a dashboard, and a metric that quietly reads zero is worse than one
 * that fails. So:
 *
 *  - `getKnex()` is called in this file and nowhere else — grep for it and this is the only hit;
 *  - the accountId is injected by the service, from the request scope, never from a caller argument
 *    that could be spoofed or forgotten;
 *  - the SQL must contain the `:accountId` binding, and the service refuses to run it otherwise.
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
   *   'select count(*) as total from companies where account_id = :accountId and deleted_at is null',
   * );
   */
  async scoped<T = Record<string, unknown>>(
    sql: string,
    bindings: Record<string, unknown> = {},
  ): Promise<T[]> {
    if (!sql.includes(':accountId')) {
      throw new Error(
        'Raw query sem escopo de tenant: o SQL precisa referenciar :accountId no WHERE. ' +
          'Se a intenção é cruzar contas, use operatorScoped() — e revise o call site.',
      );
    }
    if ('accountId' in bindings) {
      // The scope is not a caller-supplied value. Silently overriding it would be worse.
      throw new Error('Não passe accountId nos bindings: ele vem do escopo do request.');
    }

    const accountId = this.tenantContext.requireAccountId();
    const result = await this.em.getKnex().raw(sql, { ...bindings, accountId });
    return this.rows<T>(result);
  }

  /**
   * Cross-tenant raw query, for operator tooling only (CLI, maintenance). Under the runtime role
   * RLS still applies and this returns nothing — which is intended: it is usable only from a
   * process connected as the owner. A separate, deliberately awkward name rather than a flag on
   * `scoped()`, so every call site reads as the exception it is.
   */
  async operatorScoped<T = Record<string, unknown>>(
    sql: string,
    bindings: Record<string, unknown> = {},
  ): Promise<T[]> {
    this.logger.debug('Raw query de operador (cruza contas)');
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
