import { MediaInsightSnapshot } from '../../domain/entities/media-insight-snapshot.entity';

/** Application-boundary view of a single insight capture. */
export class InsightSnapshotDto {
  capturedAt!: Date;
  reach!: number;
  impressions!: number;
  likes!: number;
  comments!: number;
  saved!: number;
  sharesCount!: number;

  static fromDomain(snapshot: MediaInsightSnapshot): InsightSnapshotDto {
    const dto = new InsightSnapshotDto();
    dto.capturedAt = snapshot.capturedAt;
    dto.reach = snapshot.reach;
    dto.impressions = snapshot.impressions;
    dto.likes = snapshot.likes;
    dto.comments = snapshot.comments;
    dto.saved = snapshot.saved;
    dto.sharesCount = snapshot.sharesCount;
    return dto;
  }
}
