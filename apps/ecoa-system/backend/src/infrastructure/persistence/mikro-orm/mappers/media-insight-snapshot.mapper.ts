import { Injectable } from '@nestjs/common';
import { MediaInsightSnapshot } from '../../../../contexts/insight/domain/entities/media-insight-snapshot.entity';
import { SnapshotId } from '../../../../contexts/insight/domain/value-objects/snapshot-id.vo';
import { MediaInsightSnapshotOrmEntity } from '../entities/media-insight-snapshot-orm.entity';

@Injectable()
export class MediaInsightSnapshotMapper {
  toDomain(orm: MediaInsightSnapshotOrmEntity): MediaInsightSnapshot {
    return MediaInsightSnapshot.reconstitute(
      SnapshotId.from(orm.id),
      orm.ownerId,
      orm.ownMediaId,
      orm.capturedAt,
      orm.reach,
      orm.impressions,
      orm.likes,
      orm.comments,
      orm.saved,
      orm.sharesCount,
    );
  }

  toOrm(
    domain: MediaInsightSnapshot,
    existing?: MediaInsightSnapshotOrmEntity,
  ): MediaInsightSnapshotOrmEntity {
    const orm = existing ?? new MediaInsightSnapshotOrmEntity();
    orm.id = domain.id.value;
    orm.ownerId = domain.ownerId;
    orm.ownMediaId = domain.ownMediaId;
    orm.capturedAt = domain.capturedAt;
    orm.reach = domain.reach;
    orm.impressions = domain.impressions;
    orm.likes = domain.likes;
    orm.comments = domain.comments;
    orm.saved = domain.saved;
    orm.sharesCount = domain.sharesCount;
    return orm;
  }
}
