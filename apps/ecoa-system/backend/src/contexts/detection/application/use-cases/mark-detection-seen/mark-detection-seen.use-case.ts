import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import {
  DETECTION_REPOSITORY,
  DetectionRepositoryPort,
} from '../../ports/output/detection-repository.port';
import { DetectionNotFoundException } from '../../../domain/exceptions/detection-not-found.exception';
import { DetectionDto } from '../../dto/detection.dto';
import { MarkDetectionSeenCommand } from './mark-detection-seen.command';

@Injectable()
export class MarkDetectionSeenUseCase implements UseCase<MarkDetectionSeenCommand, DetectionDto> {
  constructor(
    @Inject(DETECTION_REPOSITORY) private readonly detectionRepository: DetectionRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: MarkDetectionSeenCommand): Promise<DetectionDto> {
    // Owner-scoped lookup — a tenant can only touch its own detections.
    const detection = await this.detectionRepository.findById(command.ownerId, command.id);
    if (!detection) {
      throw new DetectionNotFoundException(command.id);
    }

    detection.markSeen();

    return this.uow.execute(async () => {
      const saved = await this.detectionRepository.save(detection);
      return DetectionDto.fromDomain(saved);
    });
  }
}
