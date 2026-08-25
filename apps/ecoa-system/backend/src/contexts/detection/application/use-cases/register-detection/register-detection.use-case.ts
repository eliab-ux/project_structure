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
import { Detection } from '../../../domain/entities/detection.entity';
import { DetectionDto } from '../../dto/detection.dto';
import { RegisterDetectionCommand } from './register-detection.command';

@Injectable()
export class RegisterDetectionUseCase implements UseCase<RegisterDetectionCommand, DetectionDto> {
  constructor(
    @Inject(DETECTION_REPOSITORY) private readonly detectionRepository: DetectionRepositoryPort,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  async execute(command: RegisterDetectionCommand): Promise<DetectionDto> {
    const detection = Detection.register({
      ownerId: command.ownerId,
      sourceUsername: command.sourceUsername,
      detectionType: command.detectionType,
      ownMediaId: command.ownMediaId,
      watchedAccountId: command.watchedAccountId,
      permalink: command.permalink,
      detectedAt: command.detectedAt,
    });

    return this.uow.execute(async () => {
      const saved = await this.detectionRepository.save(detection);
      return DetectionDto.fromDomain(saved);
    });
  }
}
