import { DetectionDto } from '../../../../../contexts/detection/application/dto/detection.dto';
import { DetectionSummaryDto } from '../../../../../contexts/detection/application/dto/detection-summary.dto';

export class DetectionResponseDto {
  id!: string;
  sourceUsername!: string;
  detectionType!: string;
  ownMediaId!: string | null;
  watchedAccountId!: string | null;
  highlighted!: boolean;
  permalink!: string | null;
  detectedAt!: Date;
  seen!: boolean;

  static fromDto(detection: DetectionDto): DetectionResponseDto {
    const dto = new DetectionResponseDto();
    dto.id = detection.id;
    dto.sourceUsername = detection.sourceUsername;
    dto.detectionType = detection.detectionType;
    dto.ownMediaId = detection.ownMediaId;
    dto.watchedAccountId = detection.watchedAccountId;
    dto.highlighted = detection.highlighted;
    dto.permalink = detection.permalink;
    dto.detectedAt = detection.detectedAt;
    dto.seen = detection.seen;
    return dto;
  }
}

export class DetectionSummaryResponseDto {
  total!: number;
  last7Days!: number;
  last30Days!: number;
  byAccount!: Array<{ sourceUsername: string; count: number }>;

  static fromDto(summary: DetectionSummaryDto): DetectionSummaryResponseDto {
    const dto = new DetectionSummaryResponseDto();
    dto.total = summary.total;
    dto.last7Days = summary.last7Days;
    dto.last30Days = summary.last30Days;
    dto.byAccount = summary.byAccount;
    return dto;
  }
}
