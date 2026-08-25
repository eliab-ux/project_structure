import { InsightSnapshotDto } from '../../../../../contexts/insight/application/dto/insight-snapshot.dto';

export class InsightSnapshotResponseDto {
  capturedAt!: Date;
  reach!: number;
  impressions!: number;
  likes!: number;
  comments!: number;
  saved!: number;
  sharesCount!: number;

  static fromDto(dto: InsightSnapshotDto): InsightSnapshotResponseDto {
    const response = new InsightSnapshotResponseDto();
    response.capturedAt = dto.capturedAt;
    response.reach = dto.reach;
    response.impressions = dto.impressions;
    response.likes = dto.likes;
    response.comments = dto.comments;
    response.saved = dto.saved;
    response.sharesCount = dto.sharesCount;
    return response;
  }
}
