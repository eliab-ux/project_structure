import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { ThrottleConfig } from '../../../../../config/throttle.config';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import { evaluateThrottle } from '../../../domain/services/throttle-policy';
import { ChannelId } from '../../../domain/value-objects/channel-id.vo';
import { ThrottleDecision } from '../../../domain/value-objects/throttle-decision.vo';
import { ChannelNotFoundException } from '../../../domain/exceptions/channel-not-found.exception';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../ports/output/channel-repository.port';
import {
  CHANNEL_QUALITY_SNAPSHOT_REPOSITORY,
  CHANNEL_SIGNAL_SOURCE,
  ChannelQualitySnapshotRepositoryPort,
  ChannelSignalSourcePort,
} from '../../ports/output/channel-signals.port';
import { ReviewChannelQuotaCommand } from './review-channel-quota.command';

export class ThrottleReviewResultDto {
  channelId!: string;
  date!: string;
  decision!: ThrottleDecision;
  reason!: string;
  previousQuota!: number;
  computedQuota!: number;
}

/**
 * One daily throttle review for one channel (§2.1).
 *
 * Sequence, and why in this order:
 *  1. read the window of signals;
 *  2. evaluate the PURE policy — no infrastructure in the decision;
 *  3. apply the decision to the channel (which clamps to floor/ceiling);
 *  4. persist a snapshot of the closed day WITH the decision and the reason, because a quota that
 *     moved without an explainable record is exactly the opaque behaviour §2.1 forbids;
 *  5. reset the day's disconnect counter, only AFTER it was snapshotted.
 *
 * Idempotent per (channel, date): the snapshot upsert means a re-run overwrites rather than
 * duplicating. Re-running does re-apply the decision, so the job is scheduled once per day and the
 * snapshot is what an operator reads to see whether it already ran.
 */
@Injectable()
export class ReviewChannelQuotaUseCase implements UseCase<
  ReviewChannelQuotaCommand,
  ThrottleReviewResultDto
> {
  private readonly logger = new Logger(ReviewChannelQuotaUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(CHANNEL_SIGNAL_SOURCE) private readonly signals: ChannelSignalSourcePort,
    @Inject(CHANNEL_QUALITY_SNAPSHOT_REPOSITORY)
    private readonly snapshots: ChannelQualitySnapshotRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly throttleConfig: ThrottleConfig,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ReviewChannelQuotaCommand): Promise<ThrottleReviewResultDto> {
    const channel = await this.channels.findById(ChannelId.from(command.channelId));
    if (!channel) {
      throw new ChannelNotFoundException();
    }

    const thresholds = this.throttleConfig.thresholds;
    const previousQuota = channel.quota.current;

    // A terminal channel is not reviewed: there is nothing to protect and no quota to move.
    if (channel.isTerminal) {
      return this.result(
        command,
        ThrottleDecision.HOLD,
        'Canal em estado terminal — não revisado',
        previousQuota,
        previousQuota,
      );
    }

    const history = await this.signals.recentDays(
      command.channelId,
      // One extra day of history so a window of N always has N full days available.
      thresholds.evaluationWindowDays + 1,
    );

    const evaluation = evaluateThrottle(history, thresholds);

    channel.applyThrottleDecision(
      evaluation.decision,
      evaluation.reason,
      this.throttleConfig.factors,
    );

    const dayBeingClosed = await this.signals.forDate(command.channelId, command.date);

    await this.snapshots.upsert(command.accountId, {
      ...dayBeingClosed,
      channelId: command.channelId,
      computedQuota: channel.quota.current,
      decision: evaluation.decision,
      reason: evaluation.reason,
    });

    // Only now: the counter has been recorded in the snapshot and can start over.
    channel.resetDisconnectEventsForNewDay();

    const saved = await this.channels.save(channel);
    await this.events.publishAll(channel.pullDomainEvents());

    // Only decisions that actually changed something are worth a trail line; HOLD every day would
    // drown the audit log in noise. The snapshot keeps the full history regardless.
    if (evaluation.decision !== ThrottleDecision.HOLD) {
      await this.audit.execute({
        accountId: command.accountId,
        actorType: AuditActorType.SYSTEM,
        actorId: null,
        action: AuditAction.CHANNEL_THROTTLE_DECISION,
        entityType: 'channel',
        entityId: saved.id.value,
        payload: {
          date: command.date,
          decision: evaluation.decision,
          reason: evaluation.reason,
          from: previousQuota,
          to: saved.quota.current,
        },
      });
    }

    this.logger.log('Revisão de cota concluída', {
      channelId: saved.id.value,
      decision: evaluation.decision,
      from: previousQuota,
      to: saved.quota.current,
    });

    return this.result(
      command,
      evaluation.decision,
      evaluation.reason,
      previousQuota,
      saved.quota.current,
    );
  }

  private result(
    command: ReviewChannelQuotaCommand,
    decision: ThrottleDecision,
    reason: string,
    previousQuota: number,
    computedQuota: number,
  ): ThrottleReviewResultDto {
    const dto = new ThrottleReviewResultDto();
    dto.channelId = command.channelId;
    dto.date = command.date;
    dto.decision = decision;
    dto.reason = reason;
    dto.previousQuota = previousQuota;
    dto.computedQuota = computedQuota;
    return dto;
  }
}
