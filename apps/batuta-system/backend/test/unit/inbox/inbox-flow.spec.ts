import { ConfigService } from '@nestjs/config';
import { IngestInboundMessageUseCase } from '../../../src/contexts/inbox/application/use-cases/ingest-inbound-message/ingest-inbound-message.use-case';
import { IngestInboundMessageCommand } from '../../../src/contexts/inbox/application/use-cases/ingest-inbound-message/ingest-inbound-message.command';
import { SendReplyUseCase } from '../../../src/contexts/inbox/application/use-cases/send-reply/send-reply.use-case';
import { SendReplyCommand } from '../../../src/contexts/inbox/application/use-cases/send-reply/send-reply.command';
import {
  ConversationRepositoryPort,
  InboundMediaDownloaderPort,
  MessageRepositoryPort,
  QuickReplyRepositoryPort,
} from '../../../src/contexts/inbox/application/ports/output/inbox-repositories.port';
import { Conversation } from '../../../src/contexts/inbox/domain/entities/conversation.entity';
import { Message } from '../../../src/contexts/inbox/domain/entities/message.entity';
import {
  ConversationPriority,
  ConversationStatus,
} from '../../../src/contexts/inbox/domain/value-objects/conversation-status.vo';
import { IntentClass } from '../../../src/contexts/inbox/domain/value-objects/intent-class.vo';
import { MessageKind } from '../../../src/contexts/inbox/domain/value-objects/message-kind.vo';
import { ConversationLockedException } from '../../../src/contexts/inbox/domain/exceptions/conversation-locked.exception';
import { ReplyNotPossibleException } from '../../../src/contexts/inbox/domain/exceptions/reply-not-possible.exception';
import { InboxConfig } from '../../../src/config/inbox.config';
import { HandleInboundOptOutUseCase } from '../../../src/contexts/audience/application/use-cases/handle-inbound-opt-out/handle-inbound-opt-out.use-case';
import { ContactRepositoryPort } from '../../../src/contexts/audience/application/ports/output/contact-repository.port';
import { Contact } from '../../../src/contexts/audience/domain/entities/contact.entity';
import { AccountRepositoryPort } from '../../../src/contexts/account/application/ports/output/account-repository.port';
import { Account } from '../../../src/contexts/account/domain/entities/account.entity';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { AccountPlan } from '../../../src/contexts/account/domain/value-objects/account-plan.vo';
import { AccountStatus } from '../../../src/contexts/account/domain/value-objects/account-status.vo';
import { Document } from '../../../src/contexts/account/domain/value-objects/document.vo';
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
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const OPERATOR = 'aaaaaaaa-1111-4111-8111-111111111111';
const OTHER_OPERATOR = 'aaaaaaaa-2222-4222-8222-222222222222';
const CHANNEL_ID = 'cccccccc-1111-4111-8111-111111111111';
const CONVERSATION_ID = 'dddddddd-1111-4111-8111-111111111111';
const PHONE = '+5511988887777';

function contact(overrides: { optedOut?: boolean; active?: boolean } = {}): Contact {
  const created = Contact.create({
    accountId: ACCOUNT_ID,
    phone: PhoneE164.create(PHONE),
    name: 'Maria Silva',
    channelId: CHANNEL_ID,
    tags: [],
  });
  if (overrides.optedOut) {
    created.optOut('MANUAL', OPERATOR);
  }
  if (overrides.active === false) {
    created.deactivate();
  }
  created.pullDomainEvents();
  return created;
}

function channel(status = ChannelStatus.CONNECTED, quota = 100): Channel {
  return Channel.reconstitute({
    id: ChannelId.from(CHANNEL_ID),
    accountId: ACCOUNT_ID,
    label: 'Chip Principal',
    phone: PhoneE164.create('+551133334444'),
    evolutionInstanceName: `acct-${ACCOUNT_ID}-ch-${CHANNEL_ID}`,
    status,
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
}

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
    suspendedAt: null,
    suspensionReason: null,
    createdAt: new Date(),
  });
}

function conversation(
  overrides: {
    status?: ConversationStatus;
    lockedBy?: string | null;
    lockedAt?: Date | null;
  } = {},
): Conversation {
  return Conversation.reconstitute({
    id: CONVERSATION_ID,
    accountId: ACCOUNT_ID,
    contactId: 'ffffffff-1111-4111-8111-111111111111',
    channelId: CHANNEL_ID,
    status: overrides.status ?? ConversationStatus.PENDING_REPLY,
    priority: ConversationPriority.NORMAL,
    intentClass: IntentClass.QUESTION,
    lastInboundAt: new Date(Date.now() - 30 * 60_000),
    lastOutboundAt: null,
    lockedBy: overrides.lockedBy ?? null,
    lockedAt: overrides.lockedAt ?? null,
    unreadCount: 2,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date(Date.now() - 60 * 60_000),
  });
}

describe('IngestInboundMessageUseCase (§10.2)', () => {
  let conversations: jest.Mocked<ConversationRepositoryPort>;
  let messages: jest.Mocked<MessageRepositoryPort>;
  let contacts: jest.Mocked<ContactRepositoryPort>;
  let media: jest.Mocked<InboundMediaDownloaderPort>;
  let events: jest.Mocked<EventPublisherPort>;
  let optOut: jest.Mocked<Pick<HandleInboundOptOutUseCase, 'execute'>>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let useCase: IngestInboundMessageUseCase;

  const command = (
    body: string | null,
    kind = MessageKind.TEXT,
    providerId: string | null = 'WAMSG1',
  ): IngestInboundMessageCommand =>
    new IngestInboundMessageCommand(
      ACCOUNT_ID,
      CHANNEL_ID,
      PHONE,
      kind,
      body,
      providerId,
      new Date(),
    );

  beforeEach(() => {
    conversations = {
      findByContactId: jest.fn(async () => null),
      save: jest.fn(async (value: Conversation) => value),
    } as unknown as jest.Mocked<ConversationRepositoryPort>;

    messages = {
      existsByProviderMessageId: jest.fn(async () => false),
      save: jest.fn(async (value: Message) => value),
    } as unknown as jest.Mocked<MessageRepositoryPort>;

    contacts = {
      findByPhone: jest.fn(async () => contact()),
      save: jest.fn(async (value: Contact) => value),
    } as unknown as jest.Mocked<ContactRepositoryPort>;

    media = {
      download: jest.fn(async () => ({
        kind: MessageKind.AUDIO,
        storageKey: 'inbox/x/y.ogg',
        mimeType: 'audio/ogg',
        sizeBytes: 1024,
        failureReason: null,
      })),
    } as unknown as jest.Mocked<InboundMediaDownloaderPort>;

    events = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventPublisherPort>;

    optOut = {
      execute: jest.fn(async () => ({ detected: true, optedOut: true, confirmationSent: true })),
    } as never;
    audit = { execute: jest.fn() };

    useCase = new IngestInboundMessageUseCase(
      conversations,
      messages,
      contacts,
      media,
      events,
      optOut as unknown as HandleInboundOptOutUseCase,
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  it('a webhook retry is ignored instead of duplicating the message', async () => {
    messages.existsByProviderMessageId.mockResolvedValue(true);

    const result = await useCase.execute(command('bom dia'));

    expect(result.ignoredReason).toMatch(/já ingerida/i);
    expect(messages.save).not.toHaveBeenCalled();
    expect(conversations.save).not.toHaveBeenCalled();
  });

  it('an unknown number is IGNORED, never turned into a contact (§6.1, §2)', async () => {
    contacts.findByPhone.mockResolvedValue(null);

    const result = await useCase.execute(command('bom dia'));

    // Creating the contact here would be an import with no provenance and no consent basis.
    expect(result.ignoredReason).toMatch(/não pertence/i);
    expect(contacts.save).not.toHaveBeenCalled();
    expect(conversations.save).not.toHaveBeenCalled();
  });

  it('opens ONE conversation and queues it for a human', async () => {
    const result = await useCase.execute(command('quando abre a creche?'));

    expect(conversations.save).toHaveBeenCalledTimes(1);
    expect(result.intentClass).toBe(IntentClass.QUESTION);
    expect(result.queued).toBe(true);
    expect(result.autoResolved).toBe(false);
  });

  it('a second message REOPENS the same conversation instead of creating another (§10.1)', async () => {
    const existing = conversation({ status: ConversationStatus.RESOLVED });
    conversations.findByContactId.mockResolvedValue(existing);

    await useCase.execute(command('voltei a perguntar'));

    expect(existing.status).toBe(ConversationStatus.PENDING_REPLY);
    // No new conversation: the same aggregate was saved.
    const [saved] = conversations.save.mock.calls[0] as [Conversation];
    expect(saved.id).toBe(CONVERSATION_ID);
  });

  it('an opt-out delegates to the §6.5 automation and archives the item', async () => {
    const result = await useCase.execute(command('PARAR'));

    expect(optOut.execute).toHaveBeenCalledTimes(1);
    expect(result.autoResolved).toBe(true);
    expect(result.queued).toBe(false);
  });

  it('an acknowledgement is archived WITHOUT replying', async () => {
    const result = await useCase.execute(command('obrigado'));

    expect(result.intentClass).toBe(IntentClass.ACKNOWLEDGMENT);
    expect(result.autoResolved).toBe(true);
    // Nothing was sent: answering "obrigado" would double a chip's traffic for nothing.
    expect(optOut.execute).not.toHaveBeenCalled();
  });

  it('a wrong number takes the contact out of routing AND still asks a human', async () => {
    const target = contact();
    contacts.findByPhone.mockResolvedValue(target);

    const result = await useCase.execute(command('é engano, não conheço'));

    expect(target.active).toBe(false);
    expect(result.queued).toBe(true);
    const flagged = audit.execute.mock.calls
      .map(([entry]) => entry as { action: AuditAction; payload: Record<string, unknown> })
      .find((entry) => entry.action === AuditAction.CONTACT_FLAGGED_FOR_REVIEW);
    expect(flagged).toBeDefined();
    expect(String(flagged?.payload.phoneMasked)).toContain('*');
  });

  it('a complaint escalates the priority of an existing conversation', async () => {
    const existing = conversation();
    conversations.findByContactId.mockResolvedValue(existing);

    await useCase.execute(command('isso é spam, vou denunciar'));

    expect(existing.priority).toBe(ConversationPriority.HIGH);
  });

  it('media is downloaded IN THE ACT and its key stored (§10.2 item 2)', async () => {
    await useCase.execute(command(null, MessageKind.AUDIO));

    expect(media.download).toHaveBeenCalledTimes(1);
    const [saved] = messages.save.mock.calls[0] as [Message];
    expect(saved.mediaStorageKey).toBe('inbox/x/y.ogg');
    expect(saved.kind).toBe(MessageKind.AUDIO);
  });

  it('a failed media download keeps the message anyway', async () => {
    media.download.mockResolvedValue({
      kind: MessageKind.AUDIO,
      storageKey: null,
      mimeType: 'audio/ogg',
      sizeBytes: null,
      failureReason: 'HTTP 404 ao baixar mídia',
    });

    const result = await useCase.execute(command(null, MessageKind.AUDIO));

    // An audio nobody can play still proves this person replied — and inbound_rate depends on it.
    expect(result.queued).toBe(true);
    const [saved] = messages.save.mock.calls[0] as [Message];
    expect(saved.mediaStorageKey).toBeNull();
  });

  it('uses the PROVIDER timestamp, so the queue ages honestly', async () => {
    const sentAt = new Date(Date.now() - 3 * 3600_000);
    await useCase.execute(
      new IngestInboundMessageCommand(
        ACCOUNT_ID,
        CHANNEL_ID,
        PHONE,
        MessageKind.TEXT,
        'mandei há três horas',
        'WAMSG9',
        sentAt,
      ),
    );

    const [saved] = messages.save.mock.calls[0] as [Message];
    expect(saved.occurredAt).toEqual(sentAt);
  });
});

describe('SendReplyUseCase (§10.4)', () => {
  let conversations: jest.Mocked<ConversationRepositoryPort>;
  let messages: jest.Mocked<MessageRepositoryPort>;
  let contacts: jest.Mocked<ContactRepositoryPort>;
  let channels: jest.Mocked<ChannelRepositoryPort>;
  let counters: jest.Mocked<ChannelDailyCounterRepositoryPort>;
  let accounts: jest.Mocked<AccountRepositoryPort>;
  let gateway: jest.Mocked<WhatsAppGatewayPort>;
  let quickReplies: jest.Mocked<QuickReplyRepositoryPort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let useCase: SendReplyUseCase;

  const command = (overrides: Partial<SendReplyCommand> = {}): SendReplyCommand =>
    new SendReplyCommand(
      ACCOUNT_ID,
      overrides.performedBy ?? OPERATOR,
      CONVERSATION_ID,
      overrides.body ?? 'A creche atende de 7h às 17h.',
      overrides.quickReplyId ?? null,
      overrides.resolve ?? false,
      '203.0.113.7',
    );

  beforeEach(() => {
    conversations = {
      findById: jest.fn(async () => conversation({ lockedBy: OPERATOR, lockedAt: new Date() })),
      save: jest.fn(async (value: Conversation) => value),
    } as unknown as jest.Mocked<ConversationRepositoryPort>;

    messages = {
      save: jest.fn(async (value: Message) => value),
    } as unknown as jest.Mocked<MessageRepositoryPort>;
    contacts = {
      findById: jest.fn(async () => contact()),
    } as unknown as jest.Mocked<ContactRepositoryPort>;
    channels = {
      findById: jest.fn(async () => channel()),
      save: jest.fn(async (value: Channel) => value),
    } as unknown as jest.Mocked<ChannelRepositoryPort>;
    counters = {
      findForChannelAndDate: jest.fn(async () => ({ campaignSends: 10, replySends: 2 })),
      incrementReplySend: jest.fn(async () => 3),
    } as unknown as jest.Mocked<ChannelDailyCounterRepositoryPort>;
    accounts = {
      findById: jest.fn(async () => account()),
    } as unknown as jest.Mocked<AccountRepositoryPort>;
    gateway = {
      sendText: jest.fn(async () => ({ providerMessageId: 'OUT1' })),
    } as unknown as jest.Mocked<WhatsAppGatewayPort>;
    quickReplies = {
      findById: jest.fn(async () => null),
      save: jest.fn(),
    } as unknown as jest.Mocked<QuickReplyRepositoryPort>;
    audit = { execute: jest.fn() };

    useCase = new SendReplyUseCase(
      conversations,
      messages,
      contacts,
      channels,
      counters,
      accounts,
      gateway,
      quickReplies,
      new InboxConfig(new ConfigService({})),
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  it('sends through the conversation channel and counts in the REPLY band', async () => {
    const result = await useCase.execute(command());

    const [input] = gateway.sendText.mock.calls[0];
    expect(input.instance.instanceName).toContain(CHANNEL_ID);
    expect(counters.incrementReplySend).toHaveBeenCalledTimes(1);
    expect(result.replySendsToday).toBe(3);
  });

  it('records the author on the message (§10.3 item 5)', async () => {
    await useCase.execute(command());

    const [saved] = messages.save.mock.calls[0] as [Message];
    expect(saved.sentBy).toBe(OPERATOR);
    expect(saved.direction).toBe('OUTBOUND');
  });

  it('refuses when another operator holds the lock', async () => {
    conversations.findById.mockResolvedValue(
      conversation({ lockedBy: OTHER_OPERATOR, lockedAt: new Date() }),
    );

    await expect(useCase.execute(command())).rejects.toThrow(ConversationLockedException);
    expect(gateway.sendText).not.toHaveBeenCalled();
  });

  it('an EXPIRED lock does not block anyone', async () => {
    conversations.findById.mockResolvedValue(
      conversation({ lockedBy: OTHER_OPERATOR, lockedAt: new Date(Date.now() - 60 * 60_000) }),
    );

    await expect(useCase.execute(command())).resolves.toBeDefined();
  });

  it('refuses to reply to a contact who opted out — even for a human', async () => {
    contacts.findById.mockResolvedValue(contact({ optedOut: true }));

    await expect(useCase.execute(command())).rejects.toThrow(ReplyNotPossibleException);
    expect(gateway.sendText).not.toHaveBeenCalled();
  });

  it.each([ChannelStatus.DISCONNECTED, ChannelStatus.DEGRADED, ChannelStatus.BANNED])(
    'refuses when the conversation channel is %s — never through another chip',
    async (status) => {
      channels.findById.mockResolvedValue(channel(status));

      await expect(useCase.execute(command())).rejects.toThrow(/mesmo número/);
      expect(gateway.sendText).not.toHaveBeenCalled();
    },
  );

  it('refuses when the chip already spent its whole daily quota', async () => {
    counters.findForChannelAndDate.mockResolvedValue({ campaignSends: 95, replySends: 5 });
    channels.findById.mockResolvedValue(channel(ChannelStatus.CONNECTED, 100));

    await expect(useCase.execute(command())).rejects.toThrow(/cota do dia/);
  });

  it('the reply band is prioritised: campaign sends do not block it below the total', async () => {
    // 80 campaign sends of a 100 quota: the campaign band (80%) is exhausted, the total is not.
    counters.findForChannelAndDate.mockResolvedValue({ campaignSends: 80, replySends: 0 });
    channels.findById.mockResolvedValue(channel(ChannelStatus.CONNECTED, 100));

    await expect(useCase.execute(command())).resolves.toBeDefined();
  });

  it('resolves the conversation when asked, in the same action', async () => {
    const target = conversation({ lockedBy: OPERATOR, lockedAt: new Date() });
    conversations.findById.mockResolvedValue(target);

    await useCase.execute(command({ resolve: true } as never));

    expect(target.status).toBe(ConversationStatus.RESOLVED);
  });

  it('never puts the message body in the audit trail (§16)', async () => {
    await useCase.execute(command({ body: 'texto sensível da resposta' } as never));

    const [entry] = audit.execute.mock.calls[0] as [{ action: AuditAction; payload: unknown }];
    expect(entry.action).toBe(AuditAction.INBOX_REPLY_SENT);
    expect(JSON.stringify(entry.payload)).not.toContain('texto sensível');
    // The length is there instead: enough to audit, nothing to leak.
    expect(JSON.stringify(entry.payload)).toContain('bodyLength');
  });
});
