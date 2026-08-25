import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  DETECTION_REPOSITORY,
  DetectionRepositoryPort,
} from '../../ports/output/detection-repository.port';
import { DetectionDto } from '../../dto/detection.dto';
import { ListDetectionsQuery } from './list-detections.query';

export interface ListDetectionsResult {
  items: DetectionDto[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ListDetectionsUseCase implements UseCase<ListDetectionsQuery, ListDetectionsResult> {
  constructor(
    @Inject(DETECTION_REPOSITORY) private readonly detectionRepository: DetectionRepositoryPort,
  ) {}

  async execute(query: ListDetectionsQuery): Promise<ListDetectionsResult> {
    const { items, total } = await this.detectionRepository.list(query.ownerId, {
      watchlistOnly: query.watchlistOnly,
      from: query.from,
      to: query.to,
      seen: query.seen,
      page: query.page,
      limit: query.limit,
    });

    return {
      items: items.map((detection) => DetectionDto.fromDomain(detection)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
