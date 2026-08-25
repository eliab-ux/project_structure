import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplyConnectionUpdateUseCase } from '../../../src/contexts/channel/application/use-cases/apply-connection-update/apply-connection-update.use-case';
import { ApplyConnectionUpdateCommand } from '../../../src/contexts/channel/application/use-cases/apply-connection-update/apply-connection-update.command';
import { ChannelRepositoryPort } from '../../../src/contexts/channel/application/ports/output/channel-repository.port';
import { Channel } from '../../../src/contexts/channel/domain/entities/channel.entity';
import { ChannelId } from '../../../src/contexts/channel/domain/value-objects/channel-id.vo';
import { ChannelStatus } from '../../../src/contexts/channel/domain/value-objects/channel-status.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';
import { QuotaBand } from '../../../src/contexts/channel/domain/value-objects/quota-band.vo';
import { EventPublisherPort } from '../../../src/infrastructure/persistence/ports/event-publisher.port';
import { GatewayConnectionState } from '../../../src/infrastructure/whatsapp/ports/whatsapp-gateway.port';
import { WebhookRejectionLog } from '../../../src/infrastructure/security/webhook-rejection.log';
import { parseInstanceName } from '../../../src/infrastructure/whatsapp/instance-name';
import { EvolutionWebhookGuard } from '../../../src/infrastructure/security/guards/evolution-webhook.guard';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CHANNEL_ID = 'aaaaaaaa-1111-4111-8111-111111111111';

function makeChannel(status: ChannelStatus = ChannelStatus.CONNECTED): Channel {
  const channel = Channel.create({
    accountId: ACCOUNT_ID,
    label: 'Chip',
    phone: PhoneE164.create('11999998888'),
    quota: QuotaBand.create(20, 150),
  });

  if (status !== ChannelStatus.PROVISIONING) {
    channel.markAwaitingQr();
  }
  if (
    status === ChannelStatus.CONNECTED ||
    status === ChannelStatus.DISCONNECTED ||
    status === ChannelStatus.DEGRADED ||
    status === ChannelStatus.RETIRED ||
    status === ChannelStatus.BANNED
  ) {
    channel.markConnected();
  }
  if (status === ChannelStatus.DISCONNECTED) {
    channel.markDisconnected();
  }
  if (status === ChannelStatus.DEGRADED) {
    channel.degrade('teste');
  }
  if (status === ChannelStatus.RETIRED) {
    channel.retire('user-1', 'motivo suficiente');
  }
  if (status === ChannelStatus.BANNED) {
    channel.declareBanned('user-1', 'motivo suficiente');
  }
  channel.pullDomainEvents();
  return channel;
}

describe('parseInstanceName', () => {
  it('recovers the tenant and the channel from the namespaced name', () => {
    const parsed = parseInstanceName(`acct-${ACCOUNT_ID}-ch-${CHANNEL_ID}`);

    // This is HOW an inbound webhook learns its tenant: from a value we generated, never from the
    // payload body, which anyone holding the shared token could set to any account.
    expect(parsed).toEqual({ accountId: ACCOUNT_ID, channelId: CHANNEL_ID });
  });

  it('rejects anything that is not ours', () => {
    expect(parseInstanceName('some-other-system-instance')).toBeNull();
    expect(parseInstanceName('acct-not-a-uuid-ch-also-not')).toBeNull();
    expect(parseInstanceName('')).toBeNull();
    expect(parseInstanceName(`acct-${ACCOUNT_ID}`)).toBeNull();
  });
});

describe('EvolutionWebhookGuard', () => {
  function contextWithToken(token?: string): ExecutionContext {
    const headers: Record<string, string> = token ? { 'x-batuta-webhook-token': token } : {};
    return {
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    } as unknown as ExecutionContext;
  }

  /** Devolve o guard e o log de recusas, porque alguns testes afirmam sobre a contagem. */
  function guardWith(expected?: string): {
    guard: EvolutionWebhookGuard;
    rejections: WebhookRejectionLog;
  } {
    const rejections = new WebhookRejectionLog();
    const guard = new EvolutionWebhookGuard(
      { get: () => expected } as unknown as ConfigService,
      rejections,
    );
    return { guard, rejections };
  }

  it('accepts the configured token', () => {
    expect(guardWith('s3cret-token').guard.canActivate(contextWithToken('s3cret-token'))).toBe(
      true,
    );
  });

  it('rejects a wrong or missing token', () => {
    expect(() => guardWith('s3cret-token').guard.canActivate(contextWithToken('wrong'))).toThrow(
      UnauthorizedException,
    );
    expect(() => guardWith('s3cret-token').guard.canActivate(contextWithToken())).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token of a different length without throwing from timingSafeEqual', () => {
    expect(() => guardWith('s3cret-token').guard.canActivate(contextWithToken('short'))).toThrow(
      UnauthorizedException,
    );
  });

  it('FAILS CLOSED when no token is configured', () => {
    // An unconfigured webhook must reject everything, not accept everything.
    expect(() => guardWith(undefined).guard.canActivate(contextWithToken('anything'))).toThrow(
      UnauthorizedException,
    );
  });

  it('COUNTS the refusal, so the diagnosis can say the calls are arriving', () => {
    // The screen reports that the webhook sends an auth header, never whether the value is right — the
    // expected token is a secret. So a mismatch used to pass every check while the backend answered 401
    // and the provider gave up: invisible, and identical to "nobody replied". A counted refusal is proof
    // of the opposite of silence.
    const { guard, rejections } = guardWith('s3cret-token');

    expect(() => guard.canActivate(contextWithToken('wrong'))).toThrow(UnauthorizedException);

    expect(rejections.snapshot().invalidTokenCount).toBe(1);
    expect(rejections.snapshot().lastInvalidTokenAt).toBeInstanceOf(Date);
  });

  it('does not count anything when the token is right', () => {
    const { guard, rejections } = guardWith('s3cret-token');

    expect(guard.canActivate(contextWithToken('s3cret-token'))).toBe(true);

    expect(rejections.snapshot().invalidTokenCount).toBe(0);
  });

  it('an unconfigured webhook is a configuration fault, not a caller sending a bad token', () => {
    // Counting it would send the operator chasing the provider's token when the variable is simply
    // missing on our side — and that is a different fix. The log already records it as an error.
    const { guard, rejections } = guardWith(undefined);

    expect(() => guard.canActivate(contextWithToken('anything'))).toThrow(UnauthorizedException);

    expect(rejections.snapshot().invalidTokenCount).toBe(0);
  });
});

describe('ApplyConnectionUpdateUseCase', () => {
  let channels: jest.Mocked<ChannelRepositoryPort>;
  let events: jest.Mocked<EventPublisherPort>;
  let useCase: ApplyConnectionUpdateUseCase;

  beforeEach(() => {
    channels = {
      findById: jest.fn(),
      findByPhone: jest.fn(),
      listByAccount: jest.fn(),
      listConnected: jest.fn(),
      save: jest.fn(async (channel) => channel),
      listAllForDailyReview: jest.fn(),
    } as unknown as jest.Mocked<ChannelRepositoryPort>;
    events = {
      publish: jest.fn(),
      publishAll: jest.fn(),
    } as unknown as jest.Mocked<EventPublisherPort>;
    useCase = new ApplyConnectionUpdateUseCase(channels, events);
  });

  function command(state: GatewayConnectionState): ApplyConnectionUpdateCommand {
    return new ApplyConnectionUpdateCommand(
      ACCOUNT_ID,
      ChannelId.from(CHANNEL_ID),
      `acct-${ACCOUNT_ID}-ch-${CHANNEL_ID}`,
      state,
      null,
    );
  }

  it('marks the channel connected on OPEN', async () => {
    const channel = makeChannel(ChannelStatus.DISCONNECTED);
    channels.findById.mockResolvedValue(channel);

    await useCase.execute(command(GatewayConnectionState.OPEN));

    expect(channel.status).toBe(ChannelStatus.CONNECTED);
    expect(channels.save).toHaveBeenCalled();
  });

  it('marks the channel disconnected on CLOSED', async () => {
    const channel = makeChannel(ChannelStatus.CONNECTED);
    channels.findById.mockResolvedValue(channel);

    await useCase.execute(command(GatewayConnectionState.CLOSED));

    expect(channel.status).toBe(ChannelStatus.DISCONNECTED);
  });

  it('NEVER promotes to BANNED or RETIRED, even when the instance is MISSING', async () => {
    const channel = makeChannel(ChannelStatus.CONNECTED);
    channels.findById.mockResolvedValue(channel);

    await useCase.execute(command(GatewayConnectionState.MISSING));

    // §5 FASE 2 item 4: the ceiling of what a webhook may do is DISCONNECTED.
    expect(channel.status).toBe(ChannelStatus.DISCONNECTED);
    expect(channel.isTerminal).toBe(false);
  });

  it('ignores CONNECTING so the disconnect signal is not inflated', async () => {
    const channel = makeChannel(ChannelStatus.CONNECTED);
    channels.findById.mockResolvedValue(channel);

    await useCase.execute(command(GatewayConnectionState.CONNECTING));

    expect(channel.status).toBe(ChannelStatus.CONNECTED);
    expect(channel.disconnectEventsToday).toBe(0);
    expect(channels.save).not.toHaveBeenCalled();
  });

  it('leaves a RETIRED channel untouched — a late webhook must not resurrect it', async () => {
    const channel = makeChannel(ChannelStatus.RETIRED);
    channels.findById.mockResolvedValue(channel);

    await useCase.execute(command(GatewayConnectionState.OPEN));

    expect(channel.status).toBe(ChannelStatus.RETIRED);
    expect(channels.save).not.toHaveBeenCalled();
  });

  it('leaves a BANNED channel untouched', async () => {
    const channel = makeChannel(ChannelStatus.BANNED);
    channels.findById.mockResolvedValue(channel);

    await useCase.execute(command(GatewayConnectionState.OPEN));

    expect(channel.status).toBe(ChannelStatus.BANNED);
    expect(channels.save).not.toHaveBeenCalled();
  });

  it('ignores an unknown channel instead of failing the webhook', async () => {
    channels.findById.mockResolvedValue(null);

    await expect(useCase.execute(command(GatewayConnectionState.OPEN))).resolves.toBeUndefined();
    expect(channels.save).not.toHaveBeenCalled();
  });

  it('publishes the domain events after persisting', async () => {
    const channel = makeChannel(ChannelStatus.DISCONNECTED);
    channels.findById.mockResolvedValue(channel);

    await useCase.execute(command(GatewayConnectionState.OPEN));

    expect(events.publishAll).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ eventName: 'channel.connected' })]),
    );
  });
});
