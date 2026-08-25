import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  INSTAGRAM_GATEWAY,
  InstagramGatewayPort,
} from '../../../../../infrastructure/integrations/instagram/ports/instagram-gateway.port';
import {
  INSIGHT_REPOSITORY,
  InsightRepositoryPort,
} from '../../ports/output/insight-repository.port';
import { MediaInsightSnapshot } from '../../../domain/entities/media-insight-snapshot.entity';
import { CaptureInsightsCommand } from './capture-insights.command';

export interface CaptureInsightsResult {
  captured: number;
}

@Injectable()
export class CaptureInsightsUseCase implements UseCase<
  CaptureInsightsCommand,
  CaptureInsightsResult
> {
  private readonly logger = new Logger(CaptureInsightsUseCase.name);

  constructor(
    @Inject(INSIGHT_REPOSITORY) private readonly insightRepository: InsightRepositoryPort,
    @Inject(INSTAGRAM_GATEWAY) private readonly instagramGateway: InstagramGatewayPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: CaptureInsightsCommand): Promise<CaptureInsightsResult> {
    let captured = 0;

    for (const media of command.media) {
      try {
        // Per-media failure is tolerated: skip and continue so one bad media does not
        // abort the whole capture run.
        const metrics = await this.instagramGateway.fetchMediaInsights(
          media.igMediaId,
          command.accessToken,
        );
        const snapshot = MediaInsightSnapshot.capture(command.ownerId, media.ownMediaId, {
          reach: metrics.reach,
          impressions: metrics.impressions,
          likes: metrics.likes,
          comments: metrics.comments,
          saved: metrics.saved,
          sharesCount: metrics.sharesCount,
        });

        await this.uow.execute(async () => {
          await this.insightRepository.save(snapshot);
        });
        captured += 1;
      } catch (error) {
        this.logger.warn('Falha ao capturar insights de mídia', {
          ownerId: command.ownerId,
          ownMediaId: media.ownMediaId,
          error,
        });
      }
    }

    return { captured };
  }
}
