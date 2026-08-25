import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CONTENT_REPOSITORY,
  ContentRepositoryPort,
} from '../../../../content/application/ports/output/content-repository.port';
import { ContentId } from '../../../../content/domain/value-objects/content-id.vo';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../../../channel/application/ports/output/channel-repository.port';
import { DistributionNotFoundException } from '../../../domain/exceptions/distribution-not-found.exception';
import { BlockedReason } from '../../../domain/value-objects/dispatch-status.vo';
import { DistributionStatus } from '../../../domain/value-objects/distribution-status.vo';
import {
  DISPATCH_REPOSITORY,
  DISTRIBUTION_REPOSITORY,
  DispatchRepositoryPort,
  DistributionRepositoryPort,
} from '../../ports/output/distribution-repositories.port';
import { GetDistributionQuery } from './get-distribution.query';

export class DistributionProgressDto {
  id!: string;
  contentId!: string;
  contentTitle!: string;
  /** The hash the plan was built from, read back from `config`. */
  plannedContentHash!: string | null;
  /** True when the content has been edited since — the plan describes text that no longer exists. */
  contentChangedSincePlanning!: boolean;
  status!: DistributionStatus;
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
  /** Percentage of the sendable rows already resolved, for the progress bar. */
  progressPercent!: number;
  /**
   * When the next pending send is due, or null when nothing is pending.
   *
   * The one number that answers "está PLANNED e não enviou nada — quebrou?". Usually it did not:
   * the chip's daily allowance was spent and the rest sits scheduled for tomorrow morning.
   */
  nextSendAt!: Date | null;

  perChannel!: {
    channelId: string;
    channelLabel: string;
    scheduled: number;
    sent: number;
    failed: number;
  }[];
  blockedByReason!: { reason: BlockedReason; count: number }[];
}

/**
 * The tracking view of a running distribution (FASE 10, screen 9).
 *
 * It reports `contentChangedSincePlanning` because that is the question the operator cannot answer by
 * looking at the numbers: every `rendered_body` was frozen at planning time (§4), so an edit after
 * planning means what is going out is NOT what the content screen shows now. The dispatches are still
 * correct — they are what was approved — but the discrepancy has to be visible rather than discovered.
 */
@Injectable()
export class GetDistributionUseCase implements UseCase<
  GetDistributionQuery,
  DistributionProgressDto
> {
  constructor(
    @Inject(DISTRIBUTION_REPOSITORY) private readonly distributions: DistributionRepositoryPort,
    @Inject(DISPATCH_REPOSITORY) private readonly dispatches: DispatchRepositoryPort,
    @Inject(CONTENT_REPOSITORY) private readonly contents: ContentRepositoryPort,
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
  ) {}

  async execute(query: GetDistributionQuery): Promise<DistributionProgressDto> {
    const distribution = await this.distributions.findById(query.distributionId);
    if (!distribution) {
      throw new DistributionNotFoundException();
    }

    const [content, counts, byChannel, blocked, channels, nextSendAt] = await Promise.all([
      this.contents.findById(ContentId.from(distribution.contentId)),
      this.dispatches.countsFor(distribution.id),
      this.dispatches.byChannelFor(distribution.id),
      this.dispatches.blockedSummaryFor(distribution.id),
      this.channels.listByAccount(),
      this.dispatches.nextPendingAt(distribution.id),
    ]);

    const labels = new Map(channels.map((channel) => [channel.id.value, channel.label]));
    const plannedHash = (distribution.config.contentHash as string | undefined) ?? null;

    const dto = new DistributionProgressDto();
    dto.id = distribution.id;
    dto.contentId = distribution.contentId;
    dto.contentTitle = content?.title ?? 'Conteúdo removido';
    dto.plannedContentHash = plannedHash;
    dto.contentChangedSincePlanning = Boolean(
      plannedHash && content && content.contentHash !== plannedHash,
    );
    dto.status = distribution.status;
    dto.windowStart = distribution.window.start;
    dto.windowEnd = distribution.window.end;
    dto.tags = distribution.targetFilter.tags;
    dto.confirmedAt = distribution.confirmedAt;
    dto.completedAt = distribution.completedAt;
    dto.createdAt = distribution.createdAt;

    dto.total = counts.total;
    dto.pending = counts.pending;
    dto.sending = counts.sending;
    dto.sent = counts.sent;
    dto.failed = counts.failed;
    dto.cancelled = counts.cancelled;
    dto.blocked = counts.blocked;
    dto.nextSendAt = nextSendAt;

    // Blocked rows are excluded from the denominator: they were never going to be sent, and counting
    // them would make a plan with many blocked contacts look permanently stuck at 60%.
    const sendable = counts.total - counts.blocked;
    dto.progressPercent =
      sendable > 0
        ? Math.round(((counts.sent + counts.failed + counts.cancelled) / sendable) * 100)
        : 100;

    dto.perChannel = byChannel.map((entry) => ({
      channelId: entry.channelId,
      channelLabel: labels.get(entry.channelId) ?? 'Canal removido',
      scheduled: entry.scheduled,
      sent: entry.sent,
      failed: entry.failed,
    }));
    dto.blockedByReason = blocked;
    return dto;
  }
}
