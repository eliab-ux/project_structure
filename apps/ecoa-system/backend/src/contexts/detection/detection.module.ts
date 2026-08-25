import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { DetectionOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/detection-orm.entity';
import { DetectionMapper } from '../../infrastructure/persistence/mikro-orm/mappers/detection.mapper';
import { MikroOrmDetectionRepository } from '../../infrastructure/persistence/mikro-orm/repositories/detection.repository';
import { DETECTION_REPOSITORY } from './application/ports/output/detection-repository.port';
import { RegisterDetectionUseCase } from './application/use-cases/register-detection/register-detection.use-case';
import { ListDetectionsUseCase } from './application/use-cases/list-detections/list-detections.use-case';
import { MarkDetectionSeenUseCase } from './application/use-cases/mark-detection-seen/mark-detection-seen.use-case';
import { GetDetectionsSummaryUseCase } from './application/use-cases/get-detections-summary/get-detections-summary.use-case';

@Module({
  imports: [MikroOrmModule.forFeature([DetectionOrmEntity])],
  providers: [
    DetectionMapper,
    { provide: DETECTION_REPOSITORY, useClass: MikroOrmDetectionRepository },
    RegisterDetectionUseCase,
    ListDetectionsUseCase,
    MarkDetectionSeenUseCase,
    GetDetectionsSummaryUseCase,
  ],
  exports: [
    DETECTION_REPOSITORY,
    RegisterDetectionUseCase,
    ListDetectionsUseCase,
    MarkDetectionSeenUseCase,
    GetDetectionsSummaryUseCase,
  ],
})
export class DetectionModule {}
