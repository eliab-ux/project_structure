import { ConfigService } from '@nestjs/config';
import { ThrottleConfig } from '../../../src/config/throttle.config';
import { RecordAuditLogUseCase } from '../../../src/contexts/audit/application/use-cases/record-audit-log.use-case';
import {
  AuditAction,
  AuditActorType,
} from '../../../src/contexts/audit/domain/value-objects/audit-action.vo';
import { ChannelRepositoryPort } from '../../../src/contexts/channel/application/ports/output/channel-repository.port';
import {
  ChannelQualitySnapshotRecord,
  ChannelQualitySnapshotRepositoryPort,
  ChannelSignalSourcePort,
} from '../../../src/contexts/channel/application/ports/output/channel-signals.port';
import { ReviewChannelQuotaUseCase } from '../../../src/contexts/channel/application/use-cases/review-channel-quota/review-channel-quota.use-case';
import { ReviewChannelQuotaCommand } from '../../../src/contexts/channel/application/use-cases/review-channel-quota/review-channel-quota.command';
import { Channel } from '../../../src/contexts/channel/domain/entities/channel.entity';
import { ChannelDaySignals } from '../../../src/contexts/channel/domain/services/throttle-policy';
import { ChannelId } from '../../../src/contexts/channel/domain/value-objects/channel-id.vo';
import { ChannelStatus } from '../../../src/contexts/channel/domain/value-objects/channel-status.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';
import { QuotaBand } from '../../../src/contexts/channel/domain/value-objects/quota-band.vo';
import { ThrottleDecision } from '../../../src/contexts/channel/domain/value-objects/throttle-decision.vo';
import { EventPublisherPort } from '../../../src/infrastructure/persistence/ports/event-publisher.port';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const DATE = '2026-08-03';

function connectedChannel(): Channel {
  const channel = Channel.create({
    accountId: ACCOUNT_ID,
    label: 'Chip',
    phone: PhoneE164.create('11999998888'),
    quota: QuotaBand.create(20, 150),
  });
  channel.markAwaitingQr();
  // The first connection deliberately resets the quota to the floor: a new chip warms up (§2.1).
  channel.markConnected();
  channel.pullDomainEvents();
  return channel;
}

/**
 * A channel that already earned its way up the ramp. Built through `reconstitute` because
 * `markConnected()` legitimately drops a first-time channel to the floor, so there is no way to
 * "create" a warmed-up channel — only to load one.
 */
function warmedChannel(current: number): Channel {
  return Channel.reconstitute({
    id: ChannelId.from('aaaaaaaa-1111-4111-8111-111111111111'),
    accountId: ACCOUNT_ID,
    label: 'Chip',
    phone: PhoneE164.create('11999998888'),
    evolutionInstanceName: `acct-${ACCOUNT_ID}-ch-aaaaaaaa-1111-4111-8111-111111111111`,
    status: ChannelStatus.CONNECTED,
    warmupStartedAt: new Date('2026-07-01T00:00:00Z'),
    quota: QuotaBand.create(20, 150, current),
    consecutiveFailures: 0,
    lastSendAt: new Date('2026-08-03T12:00:00Z'),
    lastQuotaReviewAt: null,
    disconnectEventsToday: 0,
    lastDisconnectAt: null,
    retiredAt: null,
    retiredBy: null,
    terminalReason: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
  });
}

function cleanDay(date: string): ChannelDaySignals {
  return {
    date,
    sentCount: 100,
    failedCount: 0,
    deliveredCount: 99,
    optOutCount: 0,
    inboundCount: 10,
    disconnectEvents: 0,
  };
}

describe('ReviewChannelQuotaUseCase', () => {
  let channels: jest.Mocked<ChannelRepositoryPort>;
  let signals: jest.Mocked<ChannelSignalSourcePort>;
  let snapshots: jest.Mocked<ChannelQualitySnapshotRepositoryPort>;
  let events: jest.Mocked<EventPublisherPort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let channel: Channel;
  let useCase: ReviewChannelQuotaUseCase;

  const throttleConfig = new ThrottleConfig({
    get: () => undefined,
  } as unknown as ConfigService);

  beforeEach(() => {
    channel = connectedChannel();
    channels = {
      findById: jest.fn(async () => channel),
      findByPhone: jest.fn(),
      listByAccount: jest.fn(),
      listConnected: jest.fn(),
      save: jest.fn(async (c) => c),
      listAllForDailyReview: jest.fn(),
    } as unknown as jest.Mocked<ChannelRepositoryPort>;
    signals = {
      recentDays: jest.fn(async () => []),
      forDate: jest.fn(async () => ({
        date: DATE,
        sentCount: 0,
        failedCount: 0,
        deliveredCount: 0,
        optOutCount: 0,
        inboundCount: 0,
        disconnectEvents: 0,
      })),
    } as unknown as jest.Mocked<ChannelSignalSourcePort>;
    snapshots = {
      upsert: jest.fn(),
      listForChannel: jest.fn(),
    } as unknown as jest.Mocked<ChannelQualitySnapshotRepositoryPort>;
    events = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventPublisherPort>;
    audit = { execute: jest.fn() };

    useCase = new ReviewChannelQuotaUseCase(
      channels,
      signals,
      snapshots,
      events,
      throttleConfig,
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  function command(): ReviewChannelQuotaCommand {
    return new ReviewChannelQuotaCommand(ACCOUNT_ID, channel.id.value, DATE);
  }

  it('raises the quota on clean signals and persists the decision WITH its reason', async () => {
    signals.recentDays.mockResolvedValue([
      cleanDay('2026-08-01'),
      cleanDay('2026-08-02'),
      cleanDay('2026-08-03'),
    ]);

    const result = await useCase.execute(command());

    expect(result.decision).toBe(ThrottleDecision.RAISE);
    expect(result.previousQuota).toBe(20);
    expect(result.computedQuota).toBe(24);
    // §2.1: "a decisão precisa ser auditável, não opaca".
    const snapshot = snapshots.upsert.mock.calls[0][1] as ChannelQualitySnapshotRecord;
    expect(snapshot.decision).toBe(ThrottleDecision.RAISE);
    expect(snapshot.reason).toMatch(/Sinais limpos/);
    expect(snapshot.computedQuota).toBe(24);
  });

  it('lowers aggressively when delivery collapses', async () => {
    signals.recentDays.mockResolvedValue([
      { ...cleanDay('2026-08-03'), sentCount: 100, deliveredCount: 40 },
    ]);
    channel = warmedChannel(100);
    channels.findById.mockResolvedValue(channel);

    const result = await useCase.execute(command());

    expect(result.decision).toBe(ThrottleDecision.LOWER);
    expect(result.computedQuota).toBe(50);
  });

  it('PAUSE degrades the channel and drops it to the floor', async () => {
    signals.recentDays.mockResolvedValue([{ ...cleanDay('2026-08-03'), disconnectEvents: 5 }]);
    channel = warmedChannel(100);
    channels.findById.mockResolvedValue(channel);

    const result = await useCase.execute(command());

    expect(result.decision).toBe(ThrottleDecision.PAUSE);
    expect(channel.status).toBe(ChannelStatus.DEGRADED);
    expect(result.computedQuota).toBe(20);
    // Never terminal, whatever the signals say.
    expect(channel.isTerminal).toBe(false);
  });

  it('HOLDS a channel with no data yet — the FASE 2 reality', async () => {
    signals.recentDays.mockResolvedValue([]);

    const result = await useCase.execute(command());

    expect(result.decision).toBe(ThrottleDecision.HOLD);
    expect(result.computedQuota).toBe(20);
    expect(channel.lastQuotaReviewAt).toBeInstanceOf(Date);
  });

  it('snapshots the closed day BEFORE resetting the disconnect counter', async () => {
    channel.markDisconnected();
    channel.markConnected();
    channel.pullDomainEvents();
    signals.forDate.mockResolvedValue({
      date: DATE,
      sentCount: 0,
      failedCount: 0,
      deliveredCount: 0,
      optOutCount: 0,
      inboundCount: 0,
      disconnectEvents: 1,
    });

    await useCase.execute(command());

    const snapshot = snapshots.upsert.mock.calls[0][1] as ChannelQualitySnapshotRecord;
    // The day's count survived into the record...
    expect(snapshot.disconnectEvents).toBe(1);
    // ...and only then was cleared for the new day.
    expect(channel.disconnectEventsToday).toBe(0);
  });

  it('audits only decisions that moved something, as SYSTEM', async () => {
    signals.recentDays.mockResolvedValue([
      cleanDay('2026-08-01'),
      cleanDay('2026-08-02'),
      cleanDay('2026-08-03'),
    ]);

    await useCase.execute(command());

    expect(audit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CHANNEL_THROTTLE_DECISION,
        actorType: AuditActorType.SYSTEM,
        actorId: null,
      }),
    );
  });

  it('does NOT audit a HOLD — daily noise would drown the trail', async () => {
    signals.recentDays.mockResolvedValue([]);

    await useCase.execute(command());

    expect(audit.execute).not.toHaveBeenCalled();
    // The snapshot still records it, so no history is lost.
    expect(snapshots.upsert).toHaveBeenCalled();
  });

  it('does not review a terminal channel', async () => {
    channel.retire('user-1', 'motivo suficiente');
    channel.pullDomainEvents();

    const result = await useCase.execute(command());

    expect(result.decision).toBe(ThrottleDecision.HOLD);
    expect(result.reason).toMatch(/terminal/);
    expect(snapshots.upsert).not.toHaveBeenCalled();
    expect(channels.save).not.toHaveBeenCalled();
  });

  it('asks for one extra day of history so the window is always full', async () => {
    await useCase.execute(command());

    // Window is 3 days by default; asking for 4 means a 3-day window always has 3 full days.
    expect(signals.recentDays).toHaveBeenCalledWith(channel.id.value, 4);
  });
});
