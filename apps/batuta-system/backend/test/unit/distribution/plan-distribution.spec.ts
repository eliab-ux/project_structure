import { ConfigService } from '@nestjs/config';
import { PlanDistributionUseCase } from '../../../src/contexts/distribution/application/use-cases/plan-distribution/plan-distribution.use-case';
import { PlanDistributionCommand } from '../../../src/contexts/distribution/application/use-cases/plan-distribution/plan-distribution.command';
import { ConfirmDistributionUseCase } from '../../../src/contexts/distribution/application/use-cases/confirm-distribution/confirm-distribution.use-case';
import { ConfirmDistributionCommand } from '../../../src/contexts/distribution/application/use-cases/confirm-distribution/confirm-distribution.command';
import {
  DispatchQueuePort,
  DispatchRepositoryPort,
  DistributionRepositoryPort,
} from '../../../src/contexts/distribution/application/ports/output/distribution-repositories.port';
import { Dispatch } from '../../../src/contexts/distribution/domain/entities/dispatch.entity';
import { Distribution } from '../../../src/contexts/distribution/domain/entities/distribution.entity';
import { DistributionWindow } from '../../../src/contexts/distribution/domain/value-objects/distribution-window.vo';
import { TargetFilter } from '../../../src/contexts/distribution/domain/value-objects/target-filter.vo';
import { DistributionStatus } from '../../../src/contexts/distribution/domain/value-objects/distribution-status.vo';
import {
  BlockedReason,
  DispatchStatus,
} from '../../../src/contexts/distribution/domain/value-objects/dispatch-status.vo';
import { ContentNotDispatchableException } from '../../../src/contexts/distribution/domain/exceptions/content-not-dispatchable.exception';
import { EmptyAudienceException } from '../../../src/contexts/distribution/domain/exceptions/empty-audience.exception';
import { PlanOutdatedException } from '../../../src/contexts/distribution/domain/exceptions/plan-outdated.exception';
import { DistributionConfig } from '../../../src/config/distribution.config';
import { AccountRepositoryPort } from '../../../src/contexts/account/application/ports/output/account-repository.port';
import { DailySendUsagePort } from '../../../src/contexts/account/application/ports/output/daily-send-usage.port';
import { Account } from '../../../src/contexts/account/domain/entities/account.entity';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { AccountPlan } from '../../../src/contexts/account/domain/value-objects/account-plan.vo';
import { AccountStatus } from '../../../src/contexts/account/domain/value-objects/account-status.vo';
import { Document } from '../../../src/contexts/account/domain/value-objects/document.vo';
import { AccountSuspendedException } from '../../../src/contexts/account/domain/exceptions/account-suspended.exception';
import { ContentRepositoryPort } from '../../../src/contexts/content/application/ports/output/content-repository.port';
import { Content } from '../../../src/contexts/content/domain/entities/content.entity';
import { ContentId } from '../../../src/contexts/content/domain/value-objects/content-id.vo';
import { MediaAsset } from '../../../src/contexts/content/domain/entities/media-asset.entity';
import { MediaKind } from '../../../src/contexts/content/domain/value-objects/media-kind.vo';
import { ContentNotSingleMessageException } from '../../../src/contexts/content/domain/exceptions/content-not-single-message.exception';
import { ContentClassification } from '../../../src/contexts/content/domain/value-objects/content-classification.vo';
import { ContentOrigin } from '../../../src/contexts/content/domain/value-objects/content-origin.vo';
import { ContentStatus } from '../../../src/contexts/content/domain/value-objects/content-status.vo';
import { ContactRepositoryPort } from '../../../src/contexts/audience/application/ports/output/contact-repository.port';
import { Contact } from '../../../src/contexts/audience/domain/entities/contact.entity';
import { ChannelRepositoryPort } from '../../../src/contexts/channel/application/ports/output/channel-repository.port';
import { ChannelDailyCounterRepositoryPort } from '../../../src/contexts/channel/application/ports/output/channel-signals.port';
import { Channel } from '../../../src/contexts/channel/domain/entities/channel.entity';
import { ChannelId } from '../../../src/contexts/channel/domain/value-objects/channel-id.vo';
import { ChannelStatus } from '../../../src/contexts/channel/domain/value-objects/channel-status.vo';
import { QuotaBand } from '../../../src/contexts/channel/domain/value-objects/quota-band.vo';
import { RecordAuditLogUseCase } from '../../../src/contexts/audit/application/use-cases/record-audit-log.use-case';
import { AuditAction } from '../../../src/contexts/audit/domain/value-objects/audit-action.vo';
import { EventPublisherPort } from '../../../src/infrastructure/persistence/ports/event-publisher.port';
import { UnitOfWorkPort } from '../../../src/infrastructure/persistence/ports/unit-of-work.port';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const CONTENT_ID = 'bbbbbbbb-1111-4111-8111-111111111111';
const CHANNEL_A = 'cccccccc-1111-4111-8111-111111111111';

function account(overrides: { status?: AccountStatus; ceiling?: number } = {}): Account {
  return Account.reconstitute({
    id: AccountId.from(ACCOUNT_ID),
    name: 'Gabinete',
    document: Document.create('12345678000195'),
    plan: AccountPlan.STANDARD,
    status: overrides.status ?? AccountStatus.ACTIVE,
    dailySendCeiling: overrides.ceiling ?? 1000,
    timezone: 'America/Sao_Paulo',
    evolutionServerUrl: null,
    evolutionApiKey: null,
    suspendedAt: overrides.status === AccountStatus.SUSPENDED ? new Date() : null,
    suspensionReason: overrides.status === AccountStatus.SUSPENDED ? 'abuso' : null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });
}

function approvedContent(status = ContentStatus.APPROVED, media: MediaAsset[] = []): Content {
  const draft = Content.create({
    accountId: ACCOUNT_ID,
    title: 'Aviso de atendimento',
    classification: ContentClassification.INSTITUTIONAL,
    origin: ContentOrigin.MANUAL,
    bodyBase: 'Olá {{primeiro_nome|amigo}}, o gabinete atende amanhã.',
    createdBy: USER_ID,
  });
  return Content.reconstitute({
    id: ContentId.from(CONTENT_ID),
    accountId: ACCOUNT_ID,
    title: draft.title,
    classification: draft.classification,
    origin: draft.origin,
    bodyBase: draft.bodyBase,
    sourceUrl: null,
    includeSourceUrl: false,
    status,
    contentHash: draft.contentHash,
    createdBy: USER_ID,
    approvedAt: new Date(),
    createdAt: new Date('2026-08-01T09:00:00Z'),
    variants: [],
    media,
  });
}

function image(name: string): MediaAsset {
  return MediaAsset.create({
    variantId: null,
    kind: MediaKind.IMAGE,
    storageKey: `content-media/${name}`,
    mimeType: 'image/png',
    sizeBytes: 1024,
    originalName: name,
  });
}

let phoneSeq = 900000000;
function contact(
  overrides: {
    name?: string | null;
    channelId?: string;
    active?: boolean;
    optedOut?: boolean;
    tags?: string[];
  } = {},
): Contact {
  phoneSeq += 1;
  const created = Contact.create({
    accountId: ACCOUNT_ID,
    phone: PhoneE164.create(`+5511${phoneSeq}`),
    name: overrides.name === undefined ? 'Maria Silva' : overrides.name,
    channelId: overrides.channelId ?? CHANNEL_A,
    tags: overrides.tags ?? [],
  });
  if (overrides.optedOut) {
    created.optOut('MANUAL', USER_ID);
  }
  if (overrides.active === false) {
    created.deactivate();
  }
  created.pullDomainEvents();
  return created;
}

function connectedChannel(id: string, label: string, quota = 100): Channel {
  const channel = Channel.reconstitute({
    id: ChannelId.from(id),
    accountId: ACCOUNT_ID,
    label,
    phone: PhoneE164.create('+551133334444'),
    evolutionInstanceName: `acct-${ACCOUNT_ID}-ch-${id}`,
    status: ChannelStatus.CONNECTED,
    warmupStartedAt: new Date('2026-07-01T00:00:00Z'),
    quota: QuotaBand.create(20, 150, quota),
    consecutiveFailures: 0,
    lastSendAt: null,
    lastQuotaReviewAt: null,
    disconnectEventsToday: 0,
    lastDisconnectAt: null,
    retiredAt: null,
    retiredBy: null,
    terminalReason: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
  });
  return channel;
}

function disconnectedChannel(id: string, label: string): Channel {
  return Channel.reconstitute({
    id: ChannelId.from(id),
    accountId: ACCOUNT_ID,
    label,
    phone: PhoneE164.create('+551133335555'),
    evolutionInstanceName: `acct-${ACCOUNT_ID}-ch-${id}`,
    status: ChannelStatus.DISCONNECTED,
    warmupStartedAt: new Date('2026-07-01T00:00:00Z'),
    quota: QuotaBand.create(20, 150, 50),
    consecutiveFailures: 0,
    lastSendAt: null,
    lastQuotaReviewAt: null,
    disconnectEventsToday: 1,
    lastDisconnectAt: new Date(),
    retiredAt: null,
    retiredBy: null,
    terminalReason: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
  });
}

describe('PlanDistributionUseCase (§9)', () => {
  let contents: jest.Mocked<ContentRepositoryPort>;
  let accounts: jest.Mocked<AccountRepositoryPort>;
  let usage: jest.Mocked<DailySendUsagePort>;
  let contacts: jest.Mocked<ContactRepositoryPort>;
  let channels: jest.Mocked<ChannelRepositoryPort>;
  let counters: jest.Mocked<ChannelDailyCounterRepositoryPort>;
  let distributions: jest.Mocked<DistributionRepositoryPort>;
  let dispatches: jest.Mocked<DispatchRepositoryPort>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let useCase: PlanDistributionUseCase;

  const windowStart = new Date(Date.now() + 60_000);
  const windowEnd = new Date(Date.now() + 5 * 24 * 3600_000);

  function command(overrides: Partial<PlanDistributionCommand> = {}): PlanDistributionCommand {
    return new PlanDistributionCommand(
      ACCOUNT_ID,
      USER_ID,
      CONTENT_ID,
      overrides.windowStart ?? windowStart,
      overrides.windowEnd ?? windowEnd,
      overrides.tags ?? [],
      overrides.variantMappings ?? [],
      overrides.dryRun ?? true,
      '203.0.113.7',
    );
  }

  beforeEach(() => {
    contents = {
      findById: jest.fn(async () => approvedContent()),
      save: jest.fn(),
      list: jest.fn(),
    } as unknown as jest.Mocked<ContentRepositoryPort>;

    accounts = {
      findById: jest.fn(async () => account()),
    } as unknown as jest.Mocked<AccountRepositoryPort>;

    usage = {
      totalSentToday: jest.fn(async () => 0),
    } as unknown as jest.Mocked<DailySendUsagePort>;

    contacts = {
      list: jest.fn(async () => ({
        data: [contact(), contact(), contact()],
        meta: { total: 3, page: 1, limit: 100, totalPages: 1 },
      })),
    } as unknown as jest.Mocked<ContactRepositoryPort>;

    channels = {
      listByAccount: jest.fn(async () => [connectedChannel(CHANNEL_A, 'Chip Principal')]),
    } as unknown as jest.Mocked<ChannelRepositoryPort>;

    counters = {
      findForChannelAndDate: jest.fn(async () => ({ campaignSends: 0, replySends: 0 })),
    } as unknown as jest.Mocked<ChannelDailyCounterRepositoryPort>;

    distributions = {
      save: jest.fn(async (distribution: Distribution) => distribution),
      findById: jest.fn(),
      list: jest.fn(),
      listActiveIds: jest.fn(),
    } as unknown as jest.Mocked<DistributionRepositoryPort>;

    dispatches = {
      saveMany: jest.fn(),
      listForDistribution: jest.fn(),
    } as unknown as jest.Mocked<DispatchRepositoryPort>;

    unitOfWork = {
      execute: jest.fn(async (work: () => Promise<unknown>) => work()),
    } as unknown as jest.Mocked<UnitOfWorkPort>;

    audit = { execute: jest.fn() };

    useCase = new PlanDistributionUseCase(
      contents,
      accounts,
      usage,
      contacts,
      channels,
      counters,
      distributions,
      dispatches,
      unitOfWork,
      new DistributionConfig(new ConfigService({})),
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  it('refuses content that is not APPROVED (§1.4)', async () => {
    contents.findById.mockResolvedValue(approvedContent(ContentStatus.DRAFT));

    await expect(useCase.execute(command())).rejects.toThrow(ContentNotDispatchableException);
    // Nothing was even looked up: the check is first because everything after it is wasted work.
    expect(contacts.list).not.toHaveBeenCalled();
  });

  it('refuses a content that cannot go out as one message, before scheduling anything', async () => {
    contents.findById.mockResolvedValue(
      approvedContent(ContentStatus.APPROVED, [image('foto.png'), image('cartaz.png')]),
    );

    await expect(useCase.execute(command())).rejects.toThrow(ContentNotSingleMessageException);
    // Refusing to plan is recoverable; discovering it at send time means part of the base already
    // received something other than what was approved.
    expect(contacts.list).not.toHaveBeenCalled();
  });

  it('reports on the preview what file goes with the message', async () => {
    contents.findById.mockResolvedValue(
      approvedContent(ContentStatus.APPROVED, [image('foto.png')]),
    );

    const preview = await useCase.execute(command());

    expect(preview.attachments).toEqual([{ label: 'Base', kind: 'IMAGE', fileName: 'foto.png' }]);
  });

  it('reports no attachment for a text-only campaign', async () => {
    const preview = await useCase.execute(command());

    expect(preview.attachments).toEqual([]);
  });

  it('refuses a suspended account', async () => {
    accounts.findById.mockResolvedValue(account({ status: AccountStatus.SUSPENDED }));

    await expect(useCase.execute(command())).rejects.toThrow(AccountSuspendedException);
  });

  it('a dry run persists nothing', async () => {
    const preview = await useCase.execute(command({ dryRun: true }));

    expect(preview.distributionId).toBeNull();
    expect(distributions.save).not.toHaveBeenCalled();
    expect(dispatches.saveMany).not.toHaveBeenCalled();
    expect(audit.execute).not.toHaveBeenCalled();
    expect(preview.scheduledCount).toBe(3);
  });

  it('excludes opted-out and inactive contacts, and reports the counts (§9.1)', async () => {
    contacts.list.mockResolvedValue({
      data: [contact(), contact({ optedOut: true }), contact({ active: false })],
      meta: { total: 3, page: 1, limit: 100, totalPages: 1 },
    } as never);

    const preview = await useCase.execute(command());

    expect(preview.audienceMatched).toBe(3);
    expect(preview.excludedOptedOut).toBe(1);
    expect(preview.excludedInactive).toBe(1);
    expect(preview.scheduledCount).toBe(1);
    // Excluded ≠ blocked: they were never part of the sendable audience.
    expect(preview.blockedCount).toBe(0);
  });

  it('blocks a contact whose channel cannot send, naming the channel and its state (§6.3, §9.3)', async () => {
    const deadChannel = 'dddddddd-1111-4111-8111-111111111111';
    channels.listByAccount.mockResolvedValue([
      connectedChannel(CHANNEL_A, 'Chip Principal'),
      disconnectedChannel(deadChannel, 'Chip Morto'),
    ]);
    contacts.list.mockResolvedValue({
      data: [contact(), contact({ channelId: deadChannel })],
      meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
    } as never);

    const preview = await useCase.execute(command());

    expect(preview.scheduledCount).toBe(1);
    expect(preview.blockedCount).toBe(1);
    expect(preview.blocked[0].reason).toBe(BlockedReason.SENDER_UNAVAILABLE);
    expect(preview.blocked[0].detail).toContain('Chip Morto');
    expect(preview.blocked[0].detail).toContain('DISCONNECTED');
    // The phone is masked even here: a preview screen is not a place to print numbers.
    expect(preview.blocked[0].phoneMasked).toMatch(/\*/);
  });

  it('never falls back to another channel for a blocked contact (§6.3)', async () => {
    const deadChannel = 'dddddddd-1111-4111-8111-111111111111';
    channels.listByAccount.mockResolvedValue([
      connectedChannel(CHANNEL_A, 'Chip Vivo'),
      disconnectedChannel(deadChannel, 'Chip Morto'),
    ]);
    contacts.list.mockResolvedValue({
      data: [contact({ channelId: deadChannel })],
      meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
    } as never);

    const preview = await useCase.execute(command());

    // A live channel exists and still nothing was scheduled: the contact belongs to one sender, full stop.
    expect(preview.scheduledCount).toBe(0);
    expect(preview.blockedCount).toBe(1);
  });

  it('refuses an audience with nobody sendable rather than creating an empty plan', async () => {
    contacts.list.mockResolvedValue({
      data: [contact({ optedOut: true })],
      meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
    } as never);

    await expect(useCase.execute(command())).rejects.toThrow(EmptyAudienceException);
  });

  it('counts the merge-field fallback and shows it in a sample (§7.4, §9.3)', async () => {
    contacts.list.mockResolvedValue({
      data: [contact({ name: 'Maria Silva' }), contact({ name: null }), contact({ name: 'João' })],
      meta: { total: 3, page: 1, limit: 100, totalPages: 1 },
    } as never);

    const preview = await useCase.execute(command());

    expect(preview.fallbackCount).toBe(1);
    // The fallback case is FIRST: it is the case operators forget, so the preview leads with it.
    expect(preview.samples[0].usedFallback).toBe(true);
    expect(preview.samples[0].renderedBody).toContain('amigo');
    expect(preview.samples.some((sample) => sample.renderedBody.includes('Maria'))).toBe(true);
  });

  it('persists the plan and the blocked rows in ONE transaction', async () => {
    const deadChannel = 'dddddddd-1111-4111-8111-111111111111';
    channels.listByAccount.mockResolvedValue([
      connectedChannel(CHANNEL_A, 'Chip Principal'),
      disconnectedChannel(deadChannel, 'Chip Morto'),
    ]);
    contacts.list.mockResolvedValue({
      data: [contact(), contact({ channelId: deadChannel })],
      meta: { total: 2, page: 1, limit: 100, totalPages: 1 },
    } as never);

    const created = await useCase.execute(command({ dryRun: false }));

    expect(unitOfWork.execute).toHaveBeenCalledTimes(1);
    expect(created.distributionId).not.toBeNull();
    expect(created.status).toBe(DistributionStatus.DRAFT);

    const [rows] = dispatches.saveMany.mock.calls[0] as [Dispatch[]];
    expect(rows).toHaveLength(2);
    const blocked = rows.find((row) => row.status === DispatchStatus.BLOCKED);
    // The blocked row keeps its rendered body: that is what makes a deliberate resend possible later.
    expect(blocked?.renderedBody).toContain('Olá');
    expect(blocked?.scheduledAt).toBeNull();
  });

  it('freezes the rendered text at planning time (§4)', async () => {
    contacts.list.mockResolvedValue({
      data: [contact({ name: 'Maria Silva' })],
      meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
    } as never);

    await useCase.execute(command({ dryRun: false }));

    const [rows] = dispatches.saveMany.mock.calls[0] as [Dispatch[]];
    expect(rows[0].renderedBody).toBe('Olá Maria, o gabinete atende amanhã.');
    expect(rows[0].renderedBody).not.toContain('{{');
  });

  it('audits the plan with the content hash, which pins the approved version', async () => {
    await useCase.execute(command({ dryRun: false }));

    const [entry] = audit.execute.mock.calls[0] as [
      { action: AuditAction; payload: Record<string, unknown> },
    ];
    expect(entry.action).toBe(AuditAction.DISTRIBUTION_PLANNED);
    expect(entry.payload.contentHash).toBe(approvedContent().contentHash);
    expect(entry.payload.scheduled).toBe(3);
  });

  it('snapshots the scheduling rules into config, so a stored plan stays explainable', async () => {
    await useCase.execute(command({ dryRun: false }));

    const [distribution] = distributions.save.mock.calls[0] as [Distribution];
    expect(distribution.config).toMatchObject({
      timeZone: 'America/Sao_Paulo',
      quietHoursStart: 8,
      quietHoursEnd: 21,
      minIntervalSeconds: 45,
      maxIntervalSeconds: 120,
      replyReservePercent: 20,
    });
  });

  it('reports an overflow with options instead of truncating (§9.2)', async () => {
    // 40 contacts, quota 10 → 8 per day after the reserve, and a window of a few hours.
    channels.listByAccount.mockResolvedValue([connectedChannel(CHANNEL_A, 'Chip', 10)]);
    contacts.list.mockResolvedValue({
      data: Array.from({ length: 40 }, () => contact()),
      meta: { total: 40, page: 1, limit: 100, totalPages: 1 },
    } as never);

    const preview = await useCase.execute(
      command({ windowEnd: new Date(Date.now() + 3 * 3600_000) }),
    );

    expect(preview.overflowCount).toBeGreaterThan(0);
    expect(preview.scheduledCount + preview.overflowCount).toBe(40);
    expect(preview.overflowOptions.length).toBeGreaterThan(0);
    expect(preview.overflowOptions.join(' ')).toMatch(/janela/i);
  });

  it("respects the channel's already-spent quota for today", async () => {
    /**
     * The clock is PINNED for this test, and that is the point of the setup.
     *
     * The assertion is "exactly one send fits in a two-hour window today", which only holds if those two
     * hours are inside the account's quiet hours (08:00-21:00 in Sao Paulo). Run at midnight, the window
     * falls entirely inside the silence, nothing is scheduled, and the test fails on correct code.
     *
     * It took a real failure to find: the suite passed all evening and broke when it ran after midnight.
     * A test that depends on the wall clock is a test that fails at random in CI.
     */
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    // 15:00 UTC = 12:00 in Sao Paulo: comfortably inside the sending window.
    jest.setSystemTime(new Date('2026-08-04T15:00:00Z'));

    counters.findForChannelAndDate.mockResolvedValue({ campaignSends: 79, replySends: 5 });
    channels.listByAccount.mockResolvedValue([connectedChannel(CHANNEL_A, 'Chip', 100)]);
    contacts.list.mockResolvedValue({
      data: Array.from({ length: 5 }, () => contact()),
      meta: { total: 5, page: 1, limit: 100, totalPages: 1 },
    } as never);

    const preview = await useCase.execute(
      command({
        windowStart: new Date('2026-08-04T15:00:30Z'),
        // Ends the same local day, so tomorrow's fresh allowance cannot rescue it.
        windowEnd: new Date('2026-08-04T17:00:00Z'),
      }),
    );

    // 100 − 20% = 80 allowed, 79 spent → exactly one fits.
    expect(preview.scheduledCount).toBe(1);
    expect(preview.overflowCount).toBe(4);
    expect(preview.perChannel[0].alreadySentToday).toBe(79);
    expect(preview.perChannel[0].campaignAllowance).toBe(80);

    jest.useRealTimers();
  });
});

describe('ConfirmDistributionUseCase (§9.3)', () => {
  let distributions: jest.Mocked<DistributionRepositoryPort>;
  let dispatches: jest.Mocked<DispatchRepositoryPort>;
  let contents: jest.Mocked<ContentRepositoryPort>;
  let queue: jest.Mocked<DispatchQueuePort>;
  let events: jest.Mocked<EventPublisherPort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let useCase: ConfirmDistributionUseCase;
  let distribution: Distribution;

  const DISTRIBUTION_ID = 'eeeeeeee-1111-4111-8111-111111111111';

  function draftDistribution(status = DistributionStatus.DRAFT): Distribution {
    return Distribution.reconstitute({
      id: DISTRIBUTION_ID,
      accountId: ACCOUNT_ID,
      contentId: CONTENT_ID,
      window: DistributionWindow.create(
        new Date(Date.now() + 60_000),
        new Date(Date.now() + 86_400_000),
      ),
      status,
      targetFilter: TargetFilter.create({}),
      config: { contentHash: approvedContent().contentHash },
      createdBy: USER_ID,
      confirmedAt: status === DistributionStatus.DRAFT ? null : new Date(),
      completedAt: null,
      createdAt: new Date(),
    });
  }

  beforeEach(() => {
    distribution = draftDistribution();

    distributions = {
      findById: jest.fn(async () => distribution),
      save: jest.fn(async (value: Distribution) => value),
    } as unknown as jest.Mocked<DistributionRepositoryPort>;

    dispatches = {
      listForDistribution: jest.fn(async () => ({
        data: [
          Dispatch.schedule({
            accountId: ACCOUNT_ID,
            distributionId: DISTRIBUTION_ID,
            contactId: 'ffffffff-1111-4111-8111-111111111111',
            channelId: CHANNEL_A,
            variantId: null,
            renderedBody: 'Olá Maria',
            scheduledAt: new Date(Date.now() + 120_000),
          }),
        ],
        meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
      })),
    } as unknown as jest.Mocked<DispatchRepositoryPort>;

    contents = {
      findById: jest.fn(async () => approvedContent()),
    } as unknown as jest.Mocked<ContentRepositoryPort>;

    queue = {
      enqueuePlan: jest.fn(async () => 1),
      removePlan: jest.fn(async () => 0),
    } as unknown as jest.Mocked<DispatchQueuePort>;

    events = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventPublisherPort>;

    audit = { execute: jest.fn() };

    useCase = new ConfirmDistributionUseCase(
      distributions,
      dispatches,
      contents,
      queue,
      events,
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  const command = (hash: string | null = null): ConfirmDistributionCommand =>
    new ConfirmDistributionCommand(ACCOUNT_ID, USER_ID, DISTRIBUTION_ID, hash, '203.0.113.7');

  it('moves DRAFT to PLANNED and enqueues the pending dispatches', async () => {
    const result = await useCase.execute(command());

    expect(result.status).toBe(DistributionStatus.PLANNED);
    expect(queue.enqueuePlan).toHaveBeenCalledTimes(1);
    expect(events.publishAll).toHaveBeenCalledTimes(1);
  });

  it('refuses to confirm twice — the second call would enqueue everything again', async () => {
    distribution = draftDistribution(DistributionStatus.PLANNED);
    distributions.findById.mockResolvedValue(distribution);

    await expect(useCase.execute(command())).rejects.toThrow(/PLANNED/);
    expect(queue.enqueuePlan).not.toHaveBeenCalled();
  });

  it('refuses when the content lost its approval after planning (§8.5)', async () => {
    contents.findById.mockResolvedValue(approvedContent(ContentStatus.DRAFT));

    await expect(useCase.execute(command())).rejects.toThrow(ContentNotDispatchableException);
    expect(queue.enqueuePlan).not.toHaveBeenCalled();
  });

  it('refuses when the content changed since the preview, with its own message', async () => {
    await expect(useCase.execute(command('f'.repeat(64)))).rejects.toThrow(PlanOutdatedException);
  });

  it('accepts the matching hash', async () => {
    const result = await useCase.execute(command(approvedContent().contentHash));

    expect(result.status).toBe(DistributionStatus.PLANNED);
  });

  it('audits the confirmation with how many jobs were queued', async () => {
    await useCase.execute(command());

    const [entry] = audit.execute.mock.calls[0] as [
      { action: AuditAction; payload: Record<string, unknown> },
    ];
    expect(entry.action).toBe(AuditAction.DISTRIBUTION_CONFIRMED);
    expect(entry.payload.dispatchesQueued).toBe(1);
  });
});
