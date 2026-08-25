import {
  DistributionDto,
  DistributionPreviewDto,
} from '../../../../../contexts/distribution/application/dto/distribution.dto';
import { DistributionProgressDto } from '../../../../../contexts/distribution/application/use-cases/get-distribution/get-distribution.use-case';
import { DistributionControlResultDto } from '../../../../../contexts/dispatch/application/use-cases/pause-distribution/pause-distribution.use-case';

export class DistributionResponseDto {
  id!: string;
  contentId!: string;
  contentTitle!: string;
  status!: string;
  windowStart!: Date;
  windowEnd!: Date;
  tags!: string[];
  confirmedAt!: Date | null;
  completedAt!: Date | null;
  createdAt!: Date;

  static from(dto: DistributionDto): DistributionResponseDto {
    const response = new DistributionResponseDto();
    response.id = dto.id;
    response.contentId = dto.contentId;
    response.contentTitle = dto.contentTitle;
    response.status = dto.status;
    response.windowStart = dto.windowStart;
    response.windowEnd = dto.windowEnd;
    response.tags = dto.tags;
    response.confirmedAt = dto.confirmedAt;
    response.completedAt = dto.completedAt;
    response.createdAt = dto.createdAt;
    // `createdBy` is not mapped: the operator id belongs in the audit trail, not on a list screen.
    return response;
  }
}

/**
 * The mandatory preview, as the operator sees it (§9.3).
 *
 * Note that nothing here is summarised away: the blocked list keeps its per-item reason, the overflow
 * keeps its count and its options, and the fallback count is a field of its own. A preview that
 * rounded off the bad news would defeat its purpose.
 */
export class DistributionPreviewResponseDto {
  distributionId!: string | null;
  contentId!: string;
  contentTitle!: string;
  contentHash!: string;
  classification!: string;
  status!: string | null;
  windowStart!: Date;
  windowEnd!: Date;
  timeZone!: string;

  audienceMatched!: number;
  excludedOptedOut!: number;
  excludedInactive!: number;
  scheduledCount!: number;
  overflowCount!: number;
  blockedCount!: number;

  estimatedDays!: number;
  firstSendAt!: Date | null;
  lastSendAt!: Date | null;

  perChannel!: DistributionPreviewDto['perChannel'];
  perVariant!: DistributionPreviewDto['perVariant'];
  perDay!: DistributionPreviewDto['perDay'];
  blocked!: DistributionPreviewDto['blocked'];

  fallbackCount!: number;
  samples!: DistributionPreviewDto['samples'];
  /** What travels with the text — empty when the campaign is text only. */
  attachments!: DistributionPreviewDto['attachments'];
  /** Qual dos cinco tetos produziu a estimativa, e a causa em português (Adendo 02 §3). */
  bindingConstraint!: DistributionPreviewDto['bindingConstraint'];
  bindingCapacityFirstDay!: number;
  bindingWindowExhausted!: boolean;
  bindingReason!: string;
  overflowOptions!: string[];

  static from(dto: DistributionPreviewDto): DistributionPreviewResponseDto {
    const response = new DistributionPreviewResponseDto();
    response.distributionId = dto.distributionId;
    response.contentId = dto.contentId;
    response.contentTitle = dto.contentTitle;
    response.contentHash = dto.contentHash;
    response.classification = dto.classification;
    response.status = dto.status;
    response.windowStart = dto.windowStart;
    response.windowEnd = dto.windowEnd;
    response.timeZone = dto.timeZone;
    response.audienceMatched = dto.audienceMatched;
    response.excludedOptedOut = dto.excludedOptedOut;
    response.excludedInactive = dto.excludedInactive;
    response.scheduledCount = dto.scheduledCount;
    response.overflowCount = dto.overflowCount;
    response.blockedCount = dto.blockedCount;
    response.estimatedDays = dto.estimatedDays;
    response.firstSendAt = dto.firstSendAt;
    response.lastSendAt = dto.lastSendAt;
    response.perChannel = dto.perChannel;
    response.perVariant = dto.perVariant;
    response.perDay = dto.perDay;
    response.blocked = dto.blocked;
    response.fallbackCount = dto.fallbackCount;
    response.samples = dto.samples;
    response.attachments = dto.attachments;
    response.bindingConstraint = dto.bindingConstraint;
    response.bindingCapacityFirstDay = dto.bindingCapacityFirstDay;
    response.bindingWindowExhausted = dto.bindingWindowExhausted;
    response.bindingReason = dto.bindingReason;
    response.overflowOptions = dto.overflowOptions;
    return response;
  }
}

export class DistributionProgressResponseDto {
  id!: string;
  contentId!: string;
  contentTitle!: string;
  contentChangedSincePlanning!: boolean;
  status!: string;
  windowStart!: Date;
  windowEnd!: Date;
  tags!: string[];
  confirmedAt!: Date | null;
  completedAt!: Date | null;
  createdAt!: Date;
  total!: number;
  pending!: number;
  sending!: number;
  sent!: number;
  failed!: number;
  cancelled!: number;
  blocked!: number;
  progressPercent!: number;
  /** Quando o próximo envio pendente vence. Null quando não há pendente. */
  nextSendAt!: Date | null;
  perChannel!: DistributionProgressDto['perChannel'];
  blockedByReason!: DistributionProgressDto['blockedByReason'];

  static from(dto: DistributionProgressDto): DistributionProgressResponseDto {
    const response = new DistributionProgressResponseDto();
    response.id = dto.id;
    response.contentId = dto.contentId;
    response.contentTitle = dto.contentTitle;
    response.contentChangedSincePlanning = dto.contentChangedSincePlanning;
    response.status = dto.status;
    response.windowStart = dto.windowStart;
    response.windowEnd = dto.windowEnd;
    response.tags = dto.tags;
    response.confirmedAt = dto.confirmedAt;
    response.completedAt = dto.completedAt;
    response.createdAt = dto.createdAt;
    response.total = dto.total;
    response.pending = dto.pending;
    response.sending = dto.sending;
    response.sent = dto.sent;
    response.failed = dto.failed;
    response.cancelled = dto.cancelled;
    response.blocked = dto.blocked;
    response.progressPercent = dto.progressPercent;
    response.nextSendAt = dto.nextSendAt;
    response.perChannel = dto.perChannel;
    response.blockedByReason = dto.blockedByReason;
    // `plannedContentHash` is not exposed: `contentChangedSincePlanning` is the actionable fact, and
    // the hash itself lives in the audit payload.
    return response;
  }
}

export class DistributionControlResponseDto {
  distributionId!: string;
  status!: string;
  /** Jobs removed or re-enqueued. Surfaced so pausing something already drained reads as "0". */
  jobsAffected!: number;

  static from(dto: DistributionControlResultDto): DistributionControlResponseDto {
    const response = new DistributionControlResponseDto();
    response.distributionId = dto.distributionId;
    response.status = dto.status;
    response.jobsAffected = dto.jobsAffected;
    return response;
  }
}
