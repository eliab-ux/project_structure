import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { MediaInsightSnapshotOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/media-insight-snapshot-orm.entity';
import { MediaInsightSnapshotMapper } from '../../infrastructure/persistence/mikro-orm/mappers/media-insight-snapshot.mapper';
import { MikroOrmInsightRepository } from '../../infrastructure/persistence/mikro-orm/repositories/insight.repository';
import { INSIGHT_REPOSITORY } from './application/ports/output/insight-repository.port';
import { CaptureInsightsUseCase } from './application/use-cases/capture-insights/capture-insights.use-case';
import { GetMediaInsightsSeriesUseCase } from './application/use-cases/get-media-insights-series/get-media-insights-series.use-case';

@Module({
  imports: [MikroOrmModule.forFeature([MediaInsightSnapshotOrmEntity])],
  providers: [
    MediaInsightSnapshotMapper,
    { provide: INSIGHT_REPOSITORY, useClass: MikroOrmInsightRepository },
    CaptureInsightsUseCase,
    GetMediaInsightsSeriesUseCase,
  ],
  exports: [INSIGHT_REPOSITORY, CaptureInsightsUseCase, GetMediaInsightsSeriesUseCase],
})
export class InsightModule {}
