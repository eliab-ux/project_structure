import { DetectionSummaryResult } from '../ports/output/detection-repository.port';

/** Application-boundary aggregate view of a tenant's detections. */
export class DetectionSummaryDto {
  total!: number;
  last7Days!: number;
  last30Days!: number;
  byAccount!: Array<{ sourceUsername: string; count: number }>;

  static fromResult(result: DetectionSummaryResult): DetectionSummaryDto {
    const dto = new DetectionSummaryDto();
    dto.total = result.total;
    dto.last7Days = result.last7Days;
    dto.last30Days = result.last30Days;
    dto.byAccount = result.byAccount;
    return dto;
  }
}
