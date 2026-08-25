import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  INSIGHT_REPOSITORY,
  InsightRepositoryPort,
} from '../../ports/output/insight-repository.port';
import { InsightSnapshotDto } from '../../dto/insight-snapshot.dto';
import { GetMediaInsightsSeriesQuery } from './get-media-insights-series.query';

@Injectable()
export class GetMediaInsightsSeriesUseCase implements UseCase<
  GetMediaInsightsSeriesQuery,
  InsightSnapshotDto[]
> {
  constructor(
    @Inject(INSIGHT_REPOSITORY) private readonly insightRepository: InsightRepositoryPort,
  ) {}

  async execute(query: GetMediaInsightsSeriesQuery): Promise<InsightSnapshotDto[]> {
    const series = await this.insightRepository.findSeriesByMedia(query.ownerId, query.ownMediaId);
    return series.map((snapshot) => InsightSnapshotDto.fromDomain(snapshot));
  }
}
