import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GetMediaInsightsSeriesUseCase } from '../../../../contexts/insight/application/use-cases/get-media-insights-series/get-media-insights-series.use-case';
import { GetMediaInsightsSeriesQuery } from '../../../../contexts/insight/application/use-cases/get-media-insights-series/get-media-insights-series.query';
import { JwtAuthGuard } from '../../../security/guards/jwt-auth.guard';
import { CurrentUser } from '../../../security/decorators/current-user.decorator';
import { AuthTokenPayload } from '../../../security/ports/token-service.port';
import { resolveOwnerId } from '../../../../shared/tenant/tenant';
import { InsightSnapshotResponseDto } from './dto/insight-snapshot-response.dto';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaInsightsController {
  constructor(private readonly getMediaInsightsSeriesUseCase: GetMediaInsightsSeriesUseCase) {}

  // Returns the insight time series of a single tenant media, scoped to the caller.
  // ownerId always comes from the token (never from client input); ownMediaId is the path param.
  @Get(':id/insights')
  async series(
    @Param('id') id: string,
    @CurrentUser() user: AuthTokenPayload,
  ): Promise<InsightSnapshotResponseDto[]> {
    const ownerId = resolveOwnerId(user);
    const series = await this.getMediaInsightsSeriesUseCase.execute(
      new GetMediaInsightsSeriesQuery(ownerId, id),
    );
    return series.map((dto) => InsightSnapshotResponseDto.fromDto(dto));
  }
}
