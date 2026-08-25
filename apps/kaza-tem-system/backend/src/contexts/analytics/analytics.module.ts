import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GetAdminMetricsUseCase } from './application/use-cases/get-admin-metrics/get-admin-metrics.use-case';
import { AdminMetricsRepository } from './infrastructure/admin-metrics.repository';
import { RecordVisitUseCase } from './application/use-cases/record-visit/record-visit.use-case';
import { VisitMapper } from '@infrastructure/persistence/mikro-orm/mappers/visit.mapper';
import { VisitOrmEntity } from '@infrastructure/persistence/mikro-orm/entities/visit-orm.entity';
import { VISIT_REPOSITORY } from './application/ports/output/visit-repository.port';
import { MikroOrmVisitRepository } from '@infrastructure/persistence/mikro-orm/repositories/visit.repository';

@Module({
  imports: [MikroOrmModule.forFeature([VisitOrmEntity])],
  providers: [
    AdminMetricsRepository,
    GetAdminMetricsUseCase,
    VisitMapper,
    {
      provide: VISIT_REPOSITORY,
      useClass: MikroOrmVisitRepository,
    },
    RecordVisitUseCase,
  ],
  exports: [GetAdminMetricsUseCase, RecordVisitUseCase, VISIT_REPOSITORY],
})
export class AnalyticsModule {}
