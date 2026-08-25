import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  DETECTION_REPOSITORY,
  DetectionRepositoryPort,
} from '../../ports/output/detection-repository.port';
import { DetectionSummaryDto } from '../../dto/detection-summary.dto';
import { GetDetectionsSummaryQuery } from './get-detections-summary.query';

@Injectable()
export class GetDetectionsSummaryUseCase implements UseCase<
  GetDetectionsSummaryQuery,
  DetectionSummaryDto
> {
  constructor(
    @Inject(DETECTION_REPOSITORY) private readonly detectionRepository: DetectionRepositoryPort,
  ) {}

  async execute(query: GetDetectionsSummaryQuery): Promise<DetectionSummaryDto> {
    const result = await this.detectionRepository.summary(query.ownerId, new Date());
    return DetectionSummaryDto.fromResult(result);
  }
}
