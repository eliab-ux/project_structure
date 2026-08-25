import { Injectable } from '@nestjs/common';
import { Detection } from '../../../../contexts/detection/domain/entities/detection.entity';
import { DetectionId } from '../../../../contexts/detection/domain/value-objects/detection-id.vo';
import { DetectionType } from '../../../../contexts/detection/domain/value-objects/detection-type.vo';
import { DetectionOrmEntity } from '../entities/detection-orm.entity';

@Injectable()
export class DetectionMapper {
  toDomain(orm: DetectionOrmEntity): Detection {
    return Detection.reconstitute(
      DetectionId.from(orm.id),
      orm.ownerId,
      orm.ownMediaId ?? null,
      orm.watchedAccountId ?? null,
      orm.sourceUsername,
      DetectionType.from(orm.detectionType),
      orm.detectedAt,
      orm.permalink ?? null,
      orm.seen,
    );
  }

  toOrm(domain: Detection, existing?: DetectionOrmEntity): DetectionOrmEntity {
    const orm = existing ?? new DetectionOrmEntity();
    orm.id = domain.id.value;
    orm.ownerId = domain.ownerId;
    orm.ownMediaId = domain.ownMediaId;
    orm.watchedAccountId = domain.watchedAccountId;
    orm.sourceUsername = domain.sourceUsername;
    orm.detectionType = domain.detectionType.value;
    orm.detectedAt = domain.detectedAt;
    orm.permalink = domain.permalink;
    orm.seen = domain.seen;
    return orm;
  }
}
