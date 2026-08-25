import { Detection } from '../../domain/entities/detection.entity';

/** Application-boundary view of a detection. */
export class DetectionDto {
  id!: string;
  sourceUsername!: string;
  detectionType!: string;
  ownMediaId!: string | null;
  watchedAccountId!: string | null;
  highlighted!: boolean;
  permalink!: string | null;
  detectedAt!: Date;
  seen!: boolean;

  static fromDomain(detection: Detection): DetectionDto {
    const dto = new DetectionDto();
    dto.id = detection.id.value;
    dto.sourceUsername = detection.sourceUsername;
    dto.detectionType = detection.detectionType.value;
    dto.ownMediaId = detection.ownMediaId;
    dto.watchedAccountId = detection.watchedAccountId;
    dto.highlighted = detection.highlighted;
    dto.permalink = detection.permalink;
    dto.detectedAt = detection.detectedAt;
    dto.seen = detection.seen;
    return dto;
  }
}
