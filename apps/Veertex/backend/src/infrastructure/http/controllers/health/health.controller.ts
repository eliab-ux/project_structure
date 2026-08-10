import { Controller, Get } from '@nestjs/common';
import { SkipTenantTransaction } from '../../interceptors/tenant-transaction.interceptor';

/**
 * PUBLIC and transaction-free.
 *
 * No guard: it is the container's liveness probe, and a probe that needs a token cannot run.
 * No transaction (`@SkipTenantTransaction`): it answers "this process is up", and making it depend
 * on a database round-trip would turn a slow database into a restart loop — the orchestrator would
 * kill healthy processes precisely when the system is already under strain.
 *
 * It exposes nothing beyond a timestamp: no version, no environment, no dependency status. Those
 * are useful to an operator and equally useful to someone deciding whether to attack.
 */
@Controller('health')
export class HealthController {
  @Get()
  @SkipTenantTransaction()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
