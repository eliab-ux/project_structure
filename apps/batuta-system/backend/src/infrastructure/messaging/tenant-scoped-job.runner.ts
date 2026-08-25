import { Injectable, Logger } from '@nestjs/common';
import { MikroORM, RequestContext } from '@mikro-orm/core';
import { TenantContextService } from '../security/tenant-context.service';

/**
 * Runs a background job inside a tenant scope.
 *
 * Why this exists: the mechanical isolation of FASE 1 is fed by JwtAuthGuard, and a BullMQ worker
 * has no request and no JWT. Without this, every entity query inside a job would hit the
 * default-on tenant filter with no parameters and throw — which is the correct failure, and this is
 * the correct way to satisfy it.
 *
 * What it does, in order:
 *  1. opens a `RequestContext`, which FORKS the EntityManager — so two concurrent jobs for
 *     different tenants cannot overwrite each other's scope, exactly as with HTTP requests;
 *  2. establishes the tenant scope from the accountId carried in the JOB PAYLOAD, which was written
 *     by code that already knew the tenant — never inferred inside the job;
 *  3. runs the handler.
 *
 * Every worker from FASE 7 on is expected to go through here. A job that reads business data
 * outside this wrapper is a bug, and it fails loudly rather than reading another tenant's rows.
 */
@Injectable()
export class TenantScopedJobRunner {
  private readonly logger = new Logger(TenantScopedJobRunner.name);

  // Only the ORM is injected: the scope must be established on the EntityManager FORKED inside the
  // RequestContext below, not on the shared instance the container would hand us.
  constructor(private readonly orm: MikroORM) {}

  async run<T>(accountId: string, work: () => Promise<T>): Promise<T> {
    if (!accountId) {
      // Refusing is the whole point: a job without a tenant must not run unscoped.
      throw new Error('Job sem accountId: escopo de tenant não pode ser estabelecido.');
    }

    return RequestContext.create(this.orm.em, async () => {
      const em = RequestContext.getEntityManager();
      if (!em) {
        throw new Error('RequestContext não estabelecido para o job.');
      }
      // Uses the forked EM of this context, not the shared one.
      new TenantContextService(em).establish(accountId);
      this.logger.debug('Job rodando com escopo de tenant', { accountId });
      return work();
    }) as Promise<T>;
  }

  /**
   * Opens an ORM context with NO tenant scope — for the schedulers, and for nothing else.
   *
   * A cron has no request, so MikroORM refuses the shared EntityManager outright ("Using global
   * EntityManager instance methods for context specific actions is disallowed"). That refusal is
   * right: without a fork, two overlapping ticks would share one identity map. This gives the cron
   * its own fork, the same way `run` does for a job.
   *
   * It establishes no tenant, and that is deliberate: the only reads allowed in here are the
   * cross-tenant IDENTITY listings the schedulers use to decide what to enqueue
   * (`listActiveIds`, `listAllForDailyReview`), each of which disables the tenant filter explicitly
   * and returns ids only. Every job it enqueues then goes through `run` and re-reads the row under
   * its own tenant scope. Reading business data here would be a cross-tenant leak, so don't.
   */
  async runUnscoped<T>(work: () => Promise<T>): Promise<T> {
    return RequestContext.create(this.orm.em, async () => {
      if (!RequestContext.getEntityManager()) {
        throw new Error('RequestContext não estabelecido para o scheduler.');
      }
      return work();
    }) as Promise<T>;
  }
}
