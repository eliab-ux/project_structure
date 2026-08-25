import { SyncConnectionStateUseCase } from '../../../src/contexts/channel/application/use-cases/sync-connection-state/sync-connection-state.use-case';
import { SyncConnectionStateCommand } from '../../../src/contexts/channel/application/use-cases/sync-connection-state/sync-connection-state.command';
import { ChannelRepositoryPort } from '../../../src/contexts/channel/application/ports/output/channel-repository.port';
import { Channel } from '../../../src/contexts/channel/domain/entities/channel.entity';
import { ChannelId } from '../../../src/contexts/channel/domain/value-objects/channel-id.vo';
import { ChannelStatus } from '../../../src/contexts/channel/domain/value-objects/channel-status.vo';
import { QuotaBand } from '../../../src/contexts/channel/domain/value-objects/quota-band.vo';
import { ChannelNotFoundException } from '../../../src/contexts/channel/domain/exceptions/channel-not-found.exception';
import {
  GatewayConnectionState,
  WhatsAppGatewayPort,
} from '../../../src/infrastructure/whatsapp/ports/whatsapp-gateway.port';
import { EventPublisherPort } from '../../../src/infrastructure/persistence/ports/event-publisher.port';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CHANNEL_ID = 'bbbbbbbb-1111-4111-8111-111111111111';

function makeChannel(status: ChannelStatus): Channel {
  return Channel.reconstitute({
    id: ChannelId.from(CHANNEL_ID),
    accountId: ACCOUNT_ID,
    label: 'Chip Principal',
    phone: PhoneE164.create('+5511988887777'),
    evolutionInstanceName: `acct-${ACCOUNT_ID}-ch-${CHANNEL_ID}`,
    status,
    warmupStartedAt: new Date('2026-08-01T00:00:00Z'),
    quota: QuotaBand.create(20, 150, 20),
    consecutiveFailures: 0,
    lastSendAt: null,
    lastQuotaReviewAt: null,
    disconnectEventsToday: 0,
    lastDisconnectAt: null,
    retiredAt: null,
    retiredBy: null,
    terminalReason: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
  });
}

describe('SyncConnectionStateUseCase', () => {
  let channels: jest.Mocked<ChannelRepositoryPort>;
  let gateway: jest.Mocked<Pick<WhatsAppGatewayPort, 'ensureWebhook' | 'getConnectionState'>>;
  let events: jest.Mocked<EventPublisherPort>;
  let useCase: SyncConnectionStateUseCase;

  beforeEach(() => {
    channels = {
      findById: jest.fn(async () => makeChannel(ChannelStatus.AWAITING_QR)),
      save: jest.fn(async (channel) => channel),
    } as unknown as jest.Mocked<ChannelRepositoryPort>;
    gateway = {
      ensureWebhook: jest.fn(async () => true),
      getConnectionState: jest.fn(async () => GatewayConnectionState.OPEN),
    } as unknown as jest.Mocked<Pick<WhatsAppGatewayPort, 'ensureWebhook' | 'getConnectionState'>>;
    events = { publishAll: jest.fn() } as unknown as jest.Mocked<EventPublisherPort>;

    useCase = new SyncConnectionStateUseCase(
      channels,
      gateway as unknown as WhatsAppGatewayPort,
      events,
    );
  });

  it('re-asserts the webhook before reading the state', async () => {
    // The webhook is registered at instance CREATION. An instance born while EVOLUTION_WEBHOOK_URL was
    // absent or a placeholder stays deaf forever — it sends, but acks and inbound never arrive, and
    // with no acks the throttle reads 0% delivery and floors every channel's quota. Reconciliation is
    // the place that repairs it, so the operator never has to delete and re-pair a working chip.
    await useCase.execute(new SyncConnectionStateCommand(ACCOUNT_ID, CHANNEL_ID));

    expect(gateway.ensureWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID }),
    );
  });

  it('still reconciles when the webhook could not be reconfigured', async () => {
    gateway.ensureWebhook.mockResolvedValue(false);

    const result = await useCase.execute(new SyncConnectionStateCommand(ACCOUNT_ID, CHANNEL_ID));

    // Failing here would trade a silent problem for one that stops the operator from even learning
    // whether the chip is connected.
    expect(result.status).toBe(ChannelStatus.CONNECTED);
  });

  it('promotes to CONNECTED when the instance reports open', async () => {
    const result = await useCase.execute(new SyncConnectionStateCommand(ACCOUNT_ID, CHANNEL_ID));

    expect(result.status).toBe(ChannelStatus.CONNECTED);
  });

  it('a CONNECTING instance is not a state change', async () => {
    gateway.getConnectionState.mockResolvedValue(GatewayConnectionState.CONNECTING);

    const result = await useCase.execute(new SyncConnectionStateCommand(ACCOUNT_ID, CHANNEL_ID));

    // Treating a handshake as a disconnect would inflate the disconnect signal the throttle reads.
    expect(result.status).toBe(ChannelStatus.AWAITING_QR);
  });

  it('leaves a terminal channel alone, and does not even talk to the server', async () => {
    channels.findById.mockResolvedValue(makeChannel(ChannelStatus.BANNED));

    const result = await useCase.execute(new SyncConnectionStateCommand(ACCOUNT_ID, CHANNEL_ID));

    // A terminal state is a human declaration, not the server's opinion, and the instance may
    // legitimately no longer exist.
    expect(result.status).toBe(ChannelStatus.BANNED);
    expect(gateway.getConnectionState).not.toHaveBeenCalled();
    expect(gateway.ensureWebhook).not.toHaveBeenCalled();
  });

  it('refuses an unknown channel', async () => {
    channels.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(new SyncConnectionStateCommand(ACCOUNT_ID, CHANNEL_ID)),
    ).rejects.toThrow(ChannelNotFoundException);
  });
});
