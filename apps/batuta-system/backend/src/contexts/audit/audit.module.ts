import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ThrottleConfig } from '../../config/throttle.config';
import { AUDIT_LOG_REPOSITORY } from './application/ports/output/audit-log-repository.port';
import {
  AUDIT_LOG_QUERY,
  DISTRIBUTION_REPORT_SOURCE,
  HEALTH_PANEL_SOURCE,
} from './application/ports/output/audit-query.port';
import { RecordAuditLogUseCase } from './application/use-cases/record-audit-log.use-case';
import { QueryAuditLogUseCase } from './application/use-cases/query-audit-log/query-audit-log.use-case';
import { GetHealthPanelUseCase } from './application/use-cases/get-health-panel/get-health-panel.use-case';
import { ExportDistributionReportUseCase } from './application/use-cases/export-distribution-report/export-distribution-report.use-case';
import {
  MikroOrmAuditLogQuery,
  MikroOrmDistributionReportSource,
  MikroOrmHealthPanelSource,
} from '../../infrastructure/persistence/mikro-orm/repositories/audit-query.repository';
import { AuditLogOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/audit-log-orm.entity';
import { MikroOrmAuditLogRepository } from '../../infrastructure/persistence/mikro-orm/repositories/audit-log.repository';

/**
 * Global: nearly every context has an action to record, and importing an audit module everywhere
 * would be noise. Only the write path is exposed — querying the trail belongs to FASE 9.
 */
@Global()
@Module({
  imports: [MikroOrmModule.forFeature([AuditLogOrmEntity])],
  providers: [
    // The health panel assesses channels against the throttle's OWN thresholds, so it needs the same
    // config object the channel context uses. Provided here rather than imported from ChannelModule:
    // it is a stateless reader over ConfigService (global), and importing a context module into the
    // global audit module to reach one config class would couple them for nothing.
    ThrottleConfig,
    { provide: AUDIT_LOG_REPOSITORY, useClass: MikroOrmAuditLogRepository },
    // Reading the trail is a DIFFERENT port from writing it: the write port is append-only by contract
    // (§1.6), and adding a read to it would blur the one thing it exists to guarantee.
    { provide: AUDIT_LOG_QUERY, useClass: MikroOrmAuditLogQuery },
    { provide: DISTRIBUTION_REPORT_SOURCE, useClass: MikroOrmDistributionReportSource },
    { provide: HEALTH_PANEL_SOURCE, useClass: MikroOrmHealthPanelSource },
    RecordAuditLogUseCase,
    QueryAuditLogUseCase,
    GetHealthPanelUseCase,
    ExportDistributionReportUseCase,
  ],
  exports: [
    RecordAuditLogUseCase,
    AUDIT_LOG_REPOSITORY,
    QueryAuditLogUseCase,
    GetHealthPanelUseCase,
    ExportDistributionReportUseCase,
  ],
})
export class AuditModule {}
