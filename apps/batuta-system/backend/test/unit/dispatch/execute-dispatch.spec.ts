import { ConfigService } from '@nestjs/config';
import { ExecuteDispatchUseCase } from '../../../src/contexts/dispatch/application/use-cases/execute-dispatch/execute-dispatch.use-case';
import { ExecuteDispatchCommand } from '../../../src/contexts/dispatch/application/use-cases/execute-dispatch/execute-dispatch.command';
import {
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
import { AccountRepositoryPort } from '../../../src/contexts/account/application/ports/output/account-repository.port';
import { Account } from '../../../src/contexts/account/domain/entities/account.entity';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { AccountPlan } from '../../../src/contexts/account/domain/value-objects/account-plan.vo';
import { AccountStatus } from '../../../src/contexts/account/domain/value-objects/account-status.vo';
import { Document } from '../../../src/contexts/account/domain/value-objects/document.vo';
import { ContentRepositoryPort } from '../../../src/contexts/content/application/ports/output/content-repository.port';
import { Content } from '../../../src/contexts/content/domain/entities/content.entity';
import { ContentId } from '../../../src/contexts/content/domain/value-objects/content-id.vo';
import { ContentClassification } from '../../../src/contexts/content/domain/value-objects/content-classification.vo';
import { ContentOrigin } from '../../../src/contexts/content/domain/value-objects/content-origin.vo';
import { ContentStatus } from '../../../src/contexts/content/domain/value-objects/content-status.vo';
import { MediaAsset } from '../../../src/contexts/content/domain/entities/media-asset.entity';
import { MediaKind } from '../../../src/contexts/content/domain/value-objects/media-kind.vo';
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
import { WhatsAppGatewayPort } from '../../../src/infrastructure/whatsapp/ports/whatsapp-gateway.port';
import { FileStoragePort } from '../../../src/infrastructure/storage/ports/file-storage.port';
import {
  GatewayPermanentException,
  GatewayTransientException,
} from '../../../src/infrastructure/whatsapp/exceptions/gateway.exception';
import { ThrottleConfig } from '../../../src/config/throttle.config';
import { DistributionConfig } from '../../../src/config/distribution.config';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const CONTENT_ID = 'bbbbbbbb-1111-4111-8111-111111111111';
const CHANNEL_ID = 'cccccccc-1111-4111-8111-111111111111';
const CONTACT_ID = 'dddddddd-1111-4111-8111-111111111111';
const DISTRIBUTION_ID = 'eeeeeeee-1111-4111-8111-111111111111';
const DISPATCH_ID = 'ffffffff-1111-4111-8111-111111111111';

function account(status = AccountStatus.ACTIVE): Account {
  return Account.reconstitute({
    id: AccountId.from(ACCOUNT_ID),
    name: 'Gabinete',
    document: Document.create('12345678000195'),
    plan: AccountPlan.STANDARD,
    status,
    dailySendCeiling: 1000,
    timezone: 'America/Sao_Paulo',
    evolutionServerUrl: null,
    evolutionApiKey: null,
    suspendedAt: status === AccountStatus.SUSPENDED ? new Date() : null,
    suspensionReason: status === AccountStatus.SUSPENDED ? 'abuso detectado' : null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });
}

function content(status = ContentStatus.APPROVED, media: MediaAsset[] = []): Content {
  const draft = Content.create({
    accountId: ACCOUNT_ID,
    title: 'Aviso',
    classification: ContentClassification.INSTITUTIONAL,
    origin: ContentOrigin.MANUAL,
    bodyBase: 'Olá {{primeiro_nome|amigo}}',
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
    createdAt: new Date(),
    variants: [],
    media,
  });
}

function imageAsset(variantId: string | null = null): MediaAsset {
  return MediaAsset.create({
    variantId,
    kind: MediaKind.IMAGE,
    storageKey: 'content-media/aviso.png',
    mimeType: 'image/png',
    sizeBytes: 4,
    originalName: 'aviso.png',
  });
}

function distribution(status = DistributionStatus.RUNNING): Distribution {
  return Distribution.reconstitute({
    id: DISTRIBUTION_ID,
    accountId: ACCOUNT_ID,
    contentId: CONTENT_ID,
    window: DistributionWindow.create(
      new Date(Date.now() - 3600_000),
      new Date(Date.now() + 86_400_000),
    ),
    status,
    targetFilter: TargetFilter.create({}),
    config: { timeZone: 'America/Sao_Paulo' },
    createdBy: USER_ID,
    confirmedAt: new Date(),
    completedAt: null,
    createdAt: new Date(),
  });
}

function contact(overrides: { optedOut?: boolean; active?: boolean } = {}): Contact {
  const created = Contact.create({
    accountId: ACCOUNT_ID,
    phone: PhoneE164.create('+5511988887777'),
    name: 'Maria Silva',
    channelId: CHANNEL_ID,
    tags: [],
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

function channel(status = ChannelStatus.CONNECTED, quota = 100, failures = 0): Channel {
  return Channel.reconstitute({
    id: ChannelId.from(CHANNEL_ID),
    accountId: ACCOUNT_ID,
    label: 'Chip Principal',
    phone: PhoneE164.create('+551133334444'),
    evolutionInstanceName: `acct-${ACCOUNT_ID}-ch-${CHANNEL_ID}`,
    status,
    warmupStartedAt: new Date('2026-07-01T00:00:00Z'),
    quota: QuotaBand.create(20, 150, quota),
    consecutiveFailures: failures,
    lastSendAt: null,
    lastQuotaReviewAt: null,
    disconnectEventsToday: 0,
    lastDisconnectAt: null,
    retiredAt: null,
    retiredBy: null,
    terminalReason: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
  });
}

function pendingDispatch(): Dispatch {
  return Dispatch.reconstitute({
    id: DISPATCH_ID,
    accountId: ACCOUNT_ID,
    distributionId: DISTRIBUTION_ID,
    contactId: CONTACT_ID,
    channelId: CHANNEL_ID,
    variantId: null,
    renderedBody: 'Olá Maria',
    scheduledAt: new Date(),
    status: DispatchStatus.PENDING,
    blockedReason: null,
    attempts: 0,
    evolutionMessageId: null,
    deliveryStatus: null,
    errorDetail: null,
    sentAt: null,
    createdAt: new Date(),
  });
}

describe('ExecuteDispatchUseCase (§10, FASE 7)', () => {
  let dispatches: jest.Mocked<DispatchRepositoryPort>;
  let distributions: jest.Mocked<DistributionRepositoryPort>;
  let accounts: jest.Mocked<AccountRepositoryPort>;
  let contents: jest.Mocked<ContentRepositoryPort>;
  let contacts: jest.Mocked<ContactRepositoryPort>;
  let channels: jest.Mocked<ChannelRepositoryPort>;
  let counters: jest.Mocked<ChannelDailyCounterRepositoryPort>;
  let gateway: jest.Mocked<WhatsAppGatewayPort>;
  let storage: jest.Mocked<FileStoragePort>;
  let events: jest.Mocked<EventPublisherPort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let useCase: ExecuteDispatchUseCase;
  let claimed: Dispatch;

  const command = new ExecuteDispatchCommand(
    ACCOUNT_ID,
    DISTRIBUTION_ID,
    DISPATCH_ID,
    'America/Sao_Paulo',
  );

  beforeEach(() => {
    claimed = pendingDispatch();
    // The repository claim also flips the row to SENDING; mirroring that keeps the fake honest.
    claimed.claim();

    dispatches = {
      // O guard de intervalo lê o despacho ANTES de reivindicar, para não consumir uma tentativa
      // quando o canal só precisa esperar.
      findById: jest.fn(async () => pendingDispatch()),
      claimDue: jest.fn(async () => claimed),
      save: jest.fn(async (dispatch: Dispatch) => dispatch),
    } as unknown as jest.Mocked<DispatchRepositoryPort>;

    distributions = {
      findById: jest.fn(async () => distribution()),
      save: jest.fn(async (value: Distribution) => value),
    } as unknown as jest.Mocked<DistributionRepositoryPort>;

    accounts = {
      findById: jest.fn(async () => account()),
    } as unknown as jest.Mocked<AccountRepositoryPort>;
    contents = {
      findById: jest.fn(async () => content()),
    } as unknown as jest.Mocked<ContentRepositoryPort>;
    contacts = {
      findById: jest.fn(async () => contact()),
      save: jest.fn(async (value: Contact) => value),
    } as unknown as jest.Mocked<ContactRepositoryPort>;
    channels = {
      findById: jest.fn(async () => channel()),
      save: jest.fn(async (value: Channel) => value),
      reserveSendSlot: jest.fn(async () => ({ allowed: true, waitMs: 0 })),
    } as unknown as jest.Mocked<ChannelRepositoryPort>;
    counters = {
      incrementCampaignSend: jest.fn(async () => 1),
    } as unknown as jest.Mocked<ChannelDailyCounterRepositoryPort>;
    gateway = {
      sendText: jest.fn(async () => ({ providerMessageId: 'MSG1' })),
      sendMedia: jest.fn(async () => ({ providerMessageId: 'MSG-MEDIA' })),
      sendDocument: jest.fn(async () => ({ providerMessageId: 'MSG-DOC' })),
    } as unknown as jest.Mocked<WhatsAppGatewayPort>;
    storage = {
      getObject: jest.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
    } as unknown as jest.Mocked<FileStoragePort>;
    events = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventPublisherPort>;
    audit = { execute: jest.fn() };

    useCase = new ExecuteDispatchUseCase(
      dispatches,
      distributions,
      accounts,
      contents,
      contacts,
      channels,
      counters,
      gateway,
      storage,
      events,
      new ThrottleConfig(new ConfigService({ CHANNEL_CIRCUIT_BREAKER_FAILURES: 3 })),
      new DistributionConfig(new ConfigService({ DISPATCH_MIN_INTERVAL_SECONDS: 45 })),
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  describe('the happy path', () => {
    it('sends through the channel the contact belongs to, and records the provider id', async () => {
      const result = await useCase.execute(command);

      expect(result.outcome).toBe('SENT');
      expect(gateway.sendText).toHaveBeenCalledTimes(1);
      const [input] = gateway.sendText.mock.calls[0];
      expect(input.instance.instanceName).toContain(CHANNEL_ID);
      // Digits only: a JID carries no plus sign.
      expect(input.toDigits).toBe('5511988887777');
      expect(claimed.status).toBe(DispatchStatus.SENT);
      expect(claimed.evolutionMessageId).toBe('MSG1');
      expect(claimed.sentAt).toBeInstanceOf(Date);
    });

    it('sends the FROZEN rendered body, never a re-render', async () => {
      await useCase.execute(command);

      const [input] = gateway.sendText.mock.calls[0];
      expect(input.text).toBe('Olá Maria');
    });

    it('increments the quota atomically, and BEFORE the send', async () => {
      const order: string[] = [];
      counters.incrementCampaignSend.mockImplementation(async () => {
        order.push('increment');
        return 1;
      });
      gateway.sendText.mockImplementation(async () => {
        order.push('send');
        return { providerMessageId: 'MSG1' };
      });

      await useCase.execute(command);

      // Reserving first means a failed send wastes one unit of quota; the reverse means two workers can
      // both pass the ceiling check and over-send, which costs the chip.
      expect(order).toEqual(['increment', 'send']);
      expect(counters.incrementCampaignSend).toHaveBeenCalledWith(
        ACCOUNT_ID,
        CHANNEL_ID,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      );
    });

    it('resets the consecutive failure counter on success', async () => {
      const healthy = channel(ChannelStatus.CONNECTED, 100, 2);
      channels.findById.mockResolvedValue(healthy);

      await useCase.execute(command);

      expect(healthy.consecutiveFailures).toBe(0);
    });

    it('flips the distribution to RUNNING on the first send', async () => {
      const planned = distribution(DistributionStatus.PLANNED);
      distributions.findById.mockResolvedValue(planned);

      await useCase.execute(command);

      expect(planned.status).toBe(DistributionStatus.RUNNING);
    });
  });

  /**
   * The bug this covers shipped: a campaign whose content had an image went out as bare text. The
   * approver approved a message with a picture, the recipient got a paragraph, and nothing in the
   * system said otherwise — the dispatch was marked SENT.
   */
  describe('a content with media travels as ONE message, media plus caption', () => {
    beforeEach(() => {
      contents.findById.mockResolvedValue(content(ContentStatus.APPROVED, [imageAsset()]));
    });

    it('sends the image with the rendered body as its caption, and no separate text message', async () => {
      const result = await useCase.execute(command);

      expect(result.outcome).toBe('SENT');
      expect(gateway.sendMedia).toHaveBeenCalledTimes(1);
      // Two sends would double the real volume behind a counter that only counted one.
      expect(gateway.sendText).not.toHaveBeenCalled();

      const [input] = gateway.sendMedia.mock.calls[0];
      expect(input.caption).toBe('Olá Maria');
      expect(input.mimeType).toBe('image/png');
      expect(input.fileName).toBe('aviso.png');
      expect(input.base64).toBe(Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64'));
      expect(claimed.evolutionMessageId).toBe('MSG-MEDIA');
    });

    it('reads the bytes from the account bucket, never from the job payload', async () => {
      await useCase.execute(command);

      expect(storage.getObject).toHaveBeenCalledWith(ACCOUNT_ID, 'content-media/aviso.png');
    });

    it('sends a document through sendDocument — a PDF is a file card, not an image', async () => {
      contents.findById.mockResolvedValue(
        content(ContentStatus.APPROVED, [
          MediaAsset.create({
            variantId: null,
            kind: MediaKind.DOCUMENT,
            storageKey: 'content-media/plano.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 4,
            originalName: 'plano.pdf',
          }),
        ]),
      );

      await useCase.execute(command);

      expect(gateway.sendDocument).toHaveBeenCalledTimes(1);
      expect(gateway.sendMedia).not.toHaveBeenCalled();
      expect(gateway.sendText).not.toHaveBeenCalled();
    });

    it('keeps sending plain text when the content has no media', async () => {
      contents.findById.mockResolvedValue(content());

      await useCase.execute(command);

      expect(gateway.sendText).toHaveBeenCalledTimes(1);
      expect(gateway.sendMedia).not.toHaveBeenCalled();
    });

    it('does not consume quota, degrade the chip or send anything when storage is down', async () => {
      storage.getObject.mockRejectedValue(new Error('MinIO indisponível'));

      await expect(useCase.execute(command)).rejects.toThrow('MinIO indisponível');

      // The storage is broken, not the sender: burning a unit of quota or opening the circuit
      // breaker on a healthy channel would punish the chip for someone else's outage.
      expect(counters.incrementCampaignSend).not.toHaveBeenCalled();
      expect(gateway.sendMedia).not.toHaveBeenCalled();
      expect(gateway.sendText).not.toHaveBeenCalled();
      expect(channels.save).not.toHaveBeenCalled();
      // Released, so a retry can pick the row up instead of leaving it stuck in SENDING.
      expect(claimed.status).toBe(DispatchStatus.PENDING);
    });
  });

  /**
   * Adendo 02 §1: o adiamento é espera, não falha, e o teste existe porque tratá-lo como falha seria
   * silencioso e caro — cinco adiamentos gastariam as cinco tentativas do job e o contato nunca
   * receberia nada, com o chip degradado de brinde.
   */
  describe('adiamento pelo intervalo do canal não é falha', () => {
    beforeEach(() => {
      channels.reserveSendSlot.mockResolvedValue({ allowed: false, waitMs: 15_000 });
    });

    it('devolve DEFERRED com a espera que falta, sem enviar nada', async () => {
      const result = await useCase.execute(command);

      expect(result.outcome).toBe('DEFERRED');
      expect(result.retryAfterMs).toBe(15_000);
      expect(gateway.sendText).not.toHaveBeenCalled();
    });

    it('não reivindica o despacho, então não consome tentativa', async () => {
      await useCase.execute(command);

      // `claimDue` é o que incrementa `attempts`; o guard roda antes justamente por isso.
      expect(dispatches.claimDue).not.toHaveBeenCalled();
      expect(dispatches.save).not.toHaveBeenCalled();
    });

    it('não toca no circuit breaker nem na cota', async () => {
      await useCase.execute(command);

      // Contaminar o sinal de qualidade com espera faria o throttle recuar sem motivo.
      expect(channels.save).not.toHaveBeenCalled();
      expect(counters.incrementCampaignSend).not.toHaveBeenCalled();
    });

    it('não adia um despacho que já não está pendente — nenhum slot é consumido', async () => {
      const alreadySent = pendingDispatch();
      alreadySent.claim();
      dispatches.findById.mockResolvedValue(alreadySent);

      await useCase.execute(command);

      expect(channels.reserveSendSlot).not.toHaveBeenCalled();
    });
  });

  describe('idempotency (item 1 and 3)', () => {
    it('a job whose dispatch was already claimed does nothing', async () => {
      dispatches.claimDue.mockResolvedValue(null);

      const result = await useCase.execute(command);

      expect(result.outcome).toBe('SENT');
      expect(gateway.sendText).not.toHaveBeenCalled();
      expect(counters.incrementCampaignSend).not.toHaveBeenCalled();
    });

    it('the claim carries the accountId, because raw SQL does not see the tenant filter', async () => {
      await useCase.execute(command);

      expect(dispatches.claimDue).toHaveBeenCalledWith({
        accountId: ACCOUNT_ID,
        dispatchId: DISPATCH_ID,
      });
    });
  });

  describe('runtime revalidation (item 2) — nothing is assumed from planning', () => {
    it('a SUSPENDED account blocks the send', async () => {
      accounts.findById.mockResolvedValue(account(AccountStatus.SUSPENDED));

      const result = await useCase.execute(command);

      expect(result.outcome).toBe('BLOCKED');
      expect(result.blockedReason).toBe(BlockedReason.ACCOUNT_SUSPENDED);
      expect(gateway.sendText).not.toHaveBeenCalled();
    });

    it('a content that lost its approval blocks the send (§8.5 + §1.4)', async () => {
      contents.findById.mockResolvedValue(content(ContentStatus.DRAFT));

      const result = await useCase.execute(command);

      expect(result.blockedReason).toBe(BlockedReason.CONTENT_NOT_APPROVED);
      expect(gateway.sendText).not.toHaveBeenCalled();
    });

    it('a paused distribution blocks the send', async () => {
      distributions.findById.mockResolvedValue(distribution(DistributionStatus.PAUSED));

      const result = await useCase.execute(command);

      expect(result.outcome).toBe('BLOCKED');
      expect(gateway.sendText).not.toHaveBeenCalled();
    });

    it('an opted-out contact blocks the send — the check that must never be wrong', async () => {
      contacts.findById.mockResolvedValue(contact({ optedOut: true }));

      const result = await useCase.execute(command);

      expect(result.blockedReason).toBe(BlockedReason.CONTACT_OPTED_OUT);
      expect(gateway.sendText).not.toHaveBeenCalled();
    });

    it('an inactive contact blocks the send', async () => {
      contacts.findById.mockResolvedValue(contact({ active: false }));

      const result = await useCase.execute(command);

      expect(result.blockedReason).toBe(BlockedReason.CONTACT_INACTIVE);
    });

    it.each([
      ChannelStatus.DISCONNECTED,
      ChannelStatus.DEGRADED,
      ChannelStatus.BANNED,
      ChannelStatus.RETIRED,
    ])('a channel in %s blocks the send, with no fallback to another chip', async (status) => {
      channels.findById.mockResolvedValue(channel(status));

      const result = await useCase.execute(command);

      expect(result.blockedReason).toBe(BlockedReason.SENDER_UNAVAILABLE);
      expect(gateway.sendText).not.toHaveBeenCalled();
    });

    it('blocks when the increment pushes the channel past its current quota', async () => {
      counters.incrementCampaignSend.mockResolvedValue(101);
      channels.findById.mockResolvedValue(channel(ChannelStatus.CONNECTED, 100));

      const result = await useCase.execute(command);

      expect(result.blockedReason).toBe(BlockedReason.QUOTA_EXCEEDED);
      expect(gateway.sendText).not.toHaveBeenCalled();
      expect(claimed.status).toBe(DispatchStatus.BLOCKED);
    });

    it('a blocked send is never retried — it is a decision, not a fault', async () => {
      accounts.findById.mockResolvedValue(account(AccountStatus.SUSPENDED));

      const result = await useCase.execute(command);

      expect(result.retryable).toBe(false);
    });
  });

  describe('failure handling (items 6 and 7)', () => {
    it('a transient failure goes back to PENDING and asks for a retry', async () => {
      gateway.sendText.mockRejectedValue(new GatewayTransientException('sendText', 'ECONNRESET'));

      const result = await useCase.execute(command);

      expect(result.outcome).toBe('RETRY');
      expect(result.retryable).toBe(true);
      expect(claimed.status).toBe(DispatchStatus.PENDING);
      // The attempt is preserved, so the backoff escalates rather than restarting.
      expect(claimed.attempts).toBe(1);
    });

    it('a permanent failure is FAILED at once, with no retry', async () => {
      gateway.sendText.mockRejectedValue(
        new GatewayPermanentException('sendText', 'number does not exist', 400),
      );

      const result = await useCase.execute(command);

      expect(result.outcome).toBe('FAILED');
      expect(result.retryable).toBe(false);
      expect(claimed.status).toBe(DispatchStatus.FAILED);
      expect(claimed.errorDetail).toContain('number does not exist');
    });

    it('a permanent failure takes the contact out of routing and says why in the trail', async () => {
      const target = contact();
      contacts.findById.mockResolvedValue(target);
      gateway.sendText.mockRejectedValue(
        new GatewayPermanentException('sendText', 'invalid jid', 400),
      );

      await useCase.execute(command);

      expect(target.active).toBe(false);
      const flag = audit.execute.mock.calls
        .map(([entry]) => entry as { action: AuditAction; payload: Record<string, unknown> })
        .find((entry) => entry.action === AuditAction.CONTACT_FLAGGED_FOR_REVIEW);
      expect(flag).toBeDefined();
      // Masked, never the full number (§16).
      expect(String(flag?.payload.phoneMasked)).toContain('*');
      expect(JSON.stringify(flag?.payload)).not.toContain('5511988887777');
    });

    it('an unrecognised error is treated as TRANSIENT, not permanent', async () => {
      gateway.sendText.mockRejectedValue(new Error('algo inesperado'));

      const result = await useCase.execute(command);

      // Giving up on a real recipient is worse than one extra attempt.
      expect(result.outcome).toBe('RETRY');
    });

    it('the circuit breaker degrades the channel after N consecutive failures', async () => {
      // Threshold is 3 in this suite; the channel arrives with 2 already.
      const failing = channel(ChannelStatus.CONNECTED, 100, 2);
      channels.findById.mockResolvedValue(failing);
      gateway.sendText.mockRejectedValue(new GatewayTransientException('sendText', 'ETIMEDOUT'));

      await useCase.execute(command);

      expect(failing.status).toBe(ChannelStatus.DEGRADED);
      // Degrading also drops the quota to the floor — whatever it had earned is no longer trustworthy.
      expect(failing.quota.current).toBe(failing.quota.floor);
      const degraded = audit.execute.mock.calls
        .map(([entry]) => entry as { action: AuditAction })
        .find((entry) => entry.action === AuditAction.CHANNEL_DEGRADED);
      expect(degraded).toBeDefined();
    });

    it('the breaker NEVER promotes the channel to a terminal state', async () => {
      const failing = channel(ChannelStatus.CONNECTED, 100, 10);
      channels.findById.mockResolvedValue(failing);
      gateway.sendText.mockRejectedValue(new GatewayTransientException('sendText', 'ETIMEDOUT'));

      await useCase.execute(command);

      // §4: BANNED and RETIRED are human declarations. No automatic path may reach them.
      expect(failing.status).toBe(ChannelStatus.DEGRADED);
      expect(failing.isTerminal).toBe(false);
    });

    it('a failure before the send still counts towards the breaker', async () => {
      const failing = channel(ChannelStatus.CONNECTED, 100, 0);
      channels.findById.mockResolvedValue(failing);
      gateway.sendText.mockRejectedValue(new GatewayTransientException('sendText', 'ETIMEDOUT'));

      await useCase.execute(command);

      expect(failing.consecutiveFailures).toBe(1);
    });
  });

  it('logs nothing that could leak a phone number or a message body', async () => {
    const logs: unknown[] = [];
    jest.spyOn(useCase['logger'], 'log').mockImplementation((...args) => logs.push(args));
    jest.spyOn(useCase['logger'], 'warn').mockImplementation((...args) => logs.push(args));

    await useCase.execute(command);

    const serialised = JSON.stringify(logs);
    expect(serialised).not.toContain('5511988887777');
    expect(serialised).not.toContain('Olá Maria');
  });
});
