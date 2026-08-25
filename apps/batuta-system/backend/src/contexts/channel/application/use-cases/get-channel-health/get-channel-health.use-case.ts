import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ThrottleConfig } from '../../../../../config/throttle.config';
import { evaluateThrottle } from '../../../domain/services/throttle-policy';
import { ChannelId } from '../../../domain/value-objects/channel-id.vo';
import { ChannelNotFoundException } from '../../../domain/exceptions/channel-not-found.exception';
import { ChannelDto, ChannelHealthDto } from '../../dto/channel.dto';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../ports/output/channel-repository.port';
import {
  CHANNEL_DAILY_COUNTER_REPOSITORY,
  CHANNEL_QUALITY_SNAPSHOT_REPOSITORY,
  CHANNEL_SIGNAL_SOURCE,
  ChannelDailyCounterRepositoryPort,
  ChannelQualitySnapshotRepositoryPort,
  ChannelSignalSourcePort,
} from '../../ports/output/channel-signals.port';
import { GetChannelHealthQuery } from './get-channel-health.query';

/**
 * The per-channel health panel (§2.1 item 6).
 *
 * What it shows and why: **sends per day** (the real risk metric — what the chip actually sent, not
 * what it was allowed to), `current_quota` with the full history of throttle decisions AND their
 * reasons, the three rates, consecutive failures, and connection uptime.
 *
 * The rates are recomputed here from the stored counters rather than read from a stored rate, so a
 * change in how a rate is defined never contradicts history.
 */
@Injectable()
export class GetChannelHealthUseCase implements UseCase<GetChannelHealthQuery, ChannelHealthDto> {
  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(CHANNEL_SIGNAL_SOURCE) private readonly signals: ChannelSignalSourcePort,
    @Inject(CHANNEL_QUALITY_SNAPSHOT_REPOSITORY)
    private readonly snapshots: ChannelQualitySnapshotRepositoryPort,
    @Inject(CHANNEL_DAILY_COUNTER_REPOSITORY)
    private readonly counters: ChannelDailyCounterRepositoryPort,
    private readonly throttleConfig: ThrottleConfig,
  ) {}

  async execute(query: GetChannelHealthQuery): Promise<ChannelHealthDto> {
    const channel = await this.channels.findById(ChannelId.from(query.channelId));
    if (!channel) {
      throw new ChannelNotFoundException();
    }

    const days = Math.min(Math.max(query.days, 1), 90);
    const [history, snapshots] = await Promise.all([
      this.signals.recentDays(query.channelId, days),
      this.snapshots.listForChannel(query.channelId, days),
    ]);

    const from = history[0]?.date ?? query.days.toString();
    const to = history[history.length - 1]?.date ?? from;
    const counters = history.length
      ? await this.counters.listForChannelBetween(query.channelId, from, to)
      : [];

    // Reuse the very policy the job uses, so the panel and the decision can never disagree.
    const evaluation = evaluateThrottle(history, this.throttleConfig.thresholds);

    const dto = new ChannelHealthDto();
    dto.channel = ChannelDto.fromDomain(channel);
    dto.sendsPerDay = counters.map((row) => ({
      date: row.date,
      campaignSends: row.campaignSends,
      replySends: row.replySends,
      total: row.campaignSends + row.replySends,
    }));
    dto.throttleHistory = snapshots.map((snapshot) => ({
      date: snapshot.date,
      decision: snapshot.decision,
      reason: snapshot.reason,
      computedQuota: snapshot.computedQuota,
      sentCount: snapshot.sentCount,
      deliveryRate: ratio(snapshot.deliveredCount, snapshot.sentCount),
      failureRate: ratio(snapshot.failedCount, snapshot.sentCount),
      optOutRate: ratio(snapshot.optOutCount, snapshot.sentCount),
      inboundRate: ratio(snapshot.inboundCount, snapshot.sentCount),
      disconnectEvents: snapshot.disconnectEvents,
    }));
    dto.windowMetrics = {
      daysConsidered: evaluation.metrics.daysConsidered,
      sentCount: evaluation.metrics.sentCount,
      deliveryRate: evaluation.metrics.deliveryRate,
      failureRate: evaluation.metrics.failureRate,
      optOutRate: evaluation.metrics.optOutRate,
      inboundRate: evaluation.metrics.inboundRate,
      disconnectEvents: evaluation.metrics.disconnectEvents,
    };
    dto.connectionUptimeRate = uptimeRate(history);
    return dto;
  }
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

/**
 * Share of days in the window with no disconnect event. A coarse proxy, and honest about it: the
 * webhook reports events, not durations, so we cannot claim minutes of uptime we never measured.
 */
function uptimeRate(history: readonly { disconnectEvents: number }[]): number | null {
  if (history.length === 0) {
    return null;
  }
  const cleanDays = history.filter((day) => day.disconnectEvents === 0).length;
  return Number((cleanDays / history.length).toFixed(4));
}
