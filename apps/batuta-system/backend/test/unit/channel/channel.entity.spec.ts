import { Channel } from '../../../src/contexts/channel/domain/entities/channel.entity';
import {
  ChannelStatus,
  allowsSenderMigration,
} from '../../../src/contexts/channel/domain/value-objects/channel-status.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';
import { QuotaBand } from '../../../src/contexts/channel/domain/value-objects/quota-band.vo';
import { ThrottleDecision } from '../../../src/contexts/channel/domain/value-objects/throttle-decision.vo';
import {
  ChannelInTerminalStateException,
  InvalidChannelTransitionException,
} from '../../../src/contexts/channel/domain/exceptions/invalid-channel-transition.exception';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const FACTORS = { raise: 1.2, lower: 0.5 };

function makeChannel(floor = 20, ceiling = 150): Channel {
  return Channel.create({
    accountId: ACCOUNT_ID,
    label: 'Chip principal',
    phone: PhoneE164.create('11999998888'),
    quota: QuotaBand.create(floor, ceiling),
  });
}

function connected(floor = 20, ceiling = 150): Channel {
  const channel = makeChannel(floor, ceiling);
  channel.markAwaitingQr();
  channel.markConnected();
  channel.pullDomainEvents();
  return channel;
}

describe('Channel — instance name', () => {
  it('namespaces the instance with account and channel', () => {
    const channel = makeChannel();

    // Without the namespace two tenants collide on the shared Evolution server (§5 FASE 2 item 2).
    expect(channel.evolutionInstanceName).toBe(`acct-${ACCOUNT_ID}-ch-${channel.id.value}`);
  });
});

describe('Channel — pairing', () => {
  it('starts PROVISIONING, unable to send', () => {
    const channel = makeChannel();

    expect(channel.status).toBe(ChannelStatus.PROVISIONING);
    expect(channel.canSend).toBe(false);
    expect(channel.warmupStartedAt).toBeNull();
  });

  it('walks PROVISIONING → AWAITING_QR → CONNECTED', () => {
    const channel = makeChannel();

    channel.markAwaitingQr();
    expect(channel.status).toBe(ChannelStatus.AWAITING_QR);

    channel.markConnected();
    expect(channel.status).toBe(ChannelStatus.CONNECTED);
    expect(channel.canSend).toBe(true);
  });

  it('starts warm-up at the floor on the FIRST connection', () => {
    const channel = makeChannel(20, 150);

    channel.markAwaitingQr();
    channel.markConnected();

    expect(channel.warmupStartedAt).toBeInstanceOf(Date);
    expect(channel.quota.current).toBe(20);
    expect(channel.isWarmingUp).toBe(true);
  });

  it('does NOT restart warm-up on a later reconnect', () => {
    const channel = connected();
    const firstWarmup = channel.warmupStartedAt;
    channel.applyThrottleDecision(ThrottleDecision.RAISE, 'limpo', FACTORS);
    const earnedQuota = channel.quota.current;

    channel.markDisconnected();
    channel.markConnected();

    // Otherwise every dropped connection would reset the ramp and the chip would never mature.
    expect(channel.warmupStartedAt).toEqual(firstWarmup);
    expect(channel.quota.current).toBe(earnedQuota);
  });

  it('refuses PROVISIONING → CONNECTED without pairing', () => {
    const channel = makeChannel();

    expect(() => channel.markConnected()).toThrow(InvalidChannelTransitionException);
  });

  it('emits connected/disconnected events', () => {
    const channel = makeChannel();
    channel.markAwaitingQr();

    channel.markConnected();
    expect(channel.pullDomainEvents()[0].eventName).toBe('channel.connected');

    channel.markDisconnected('celular desligado');
    expect(channel.pullDomainEvents()[0].eventName).toBe('channel.disconnected');
  });
});

describe('Channel — DISCONNECTED is transient', () => {
  it('does NOT enable sender migration', () => {
    const channel = connected();

    channel.markDisconnected();

    // §6.4: migrating 100 contacts because a battery died is irreversible in practice.
    expect(allowsSenderMigration(channel.status)).toBe(false);
    expect(channel.isTerminal).toBe(false);
  });

  it('counts every disconnect for the day, including repeats', () => {
    const channel = connected();

    channel.markDisconnected();
    channel.markDisconnected();
    channel.markDisconnected();

    // Flapping is what an unstable instance looks like from outside — and it is a throttle signal.
    expect(channel.disconnectEventsToday).toBe(3);
    expect(channel.lastDisconnectAt).toBeInstanceOf(Date);
  });

  it('resets the daily counter only when told to', () => {
    const channel = connected();
    channel.markDisconnected();

    channel.resetDisconnectEventsForNewDay();

    expect(channel.disconnectEventsToday).toBe(0);
  });

  it('can reconnect', () => {
    const channel = connected();
    channel.markDisconnected();

    channel.markConnected();

    expect(channel.status).toBe(ChannelStatus.CONNECTED);
  });
});

describe('Channel — terminal states are human-only', () => {
  it('retire records who, when and why, and enables migration', () => {
    const channel = connected();

    channel.retire('user-1', 'Chip devolvido ao fornecedor');

    expect(channel.status).toBe(ChannelStatus.RETIRED);
    expect(channel.isTerminal).toBe(true);
    expect(channel.retiredBy).toBe('user-1');
    expect(channel.retiredAt).toBeInstanceOf(Date);
    expect(channel.terminalReason).toBe('Chip devolvido ao fornecedor');
    expect(allowsSenderMigration(channel.status)).toBe(true);
    expect(channel.canSend).toBe(false);
    expect(channel.pullDomainEvents()[0].eventName).toBe('channel.retired');
  });

  it('declareBanned records the human declaration and enables migration', () => {
    const channel = connected();

    channel.declareBanned('user-1', 'Número bloqueado pelo WhatsApp');

    expect(channel.status).toBe(ChannelStatus.BANNED);
    expect(allowsSenderMigration(channel.status)).toBe(true);
    expect(channel.pullDomainEvents()[0].eventName).toBe('channel.banned');
  });

  it('a terminal channel cannot be operated any further', () => {
    const channel = connected();
    channel.retire('user-1', 'motivo suficiente');

    expect(() => channel.markConnected()).toThrow(ChannelInTerminalStateException);
    expect(() => channel.markDisconnected()).toThrow(ChannelInTerminalStateException);
    expect(() => channel.degrade('qualquer')).toThrow(ChannelInTerminalStateException);
    expect(() => channel.changeQuotaBand(10, 50)).toThrow(ChannelInTerminalStateException);
    expect(() => channel.retire('user-2', 'de novo')).toThrow(ChannelInTerminalStateException);
    expect(() => channel.declareBanned('user-2', 'de novo')).toThrow(
      ChannelInTerminalStateException,
    );
    expect(() => channel.applyThrottleDecision(ThrottleDecision.LOWER, 'x', FACTORS)).toThrow(
      ChannelInTerminalStateException,
    );
  });

  it('there is NO method that reaches a terminal state without an actor', () => {
    // The guarantee "nenhuma rotina automática promove canal a estado terminal" (§4) is structural:
    // the only two doors both require who declared it.
    const doors = Object.getOwnPropertyNames(Channel.prototype)
      .filter((name) => /retire|banned/i.test(name))
      // Methods only — the getters that merely expose retiredAt/retiredBy are not doors.
      .filter(
        (name) =>
          typeof Object.getOwnPropertyDescriptor(Channel.prototype, name)?.value === 'function',
      );
    expect(doors.sort()).toEqual(['declareBanned', 'retire']);
    expect(Channel.prototype.retire).toHaveLength(2);
    expect(Channel.prototype.declareBanned).toHaveLength(2);
  });
});

describe('Channel — circuit breaker', () => {
  it('degrades after N consecutive failures, and NOT before', () => {
    const channel = connected();

    expect(channel.registerSendFailure(3)).toBe(false);
    expect(channel.registerSendFailure(3)).toBe(false);
    expect(channel.status).toBe(ChannelStatus.CONNECTED);

    expect(channel.registerSendFailure(3)).toBe(true);
    expect(channel.status).toBe(ChannelStatus.DEGRADED);
  });

  it('NEVER escalates to BANNED — a tripped breaker asks for a human', () => {
    const channel = connected();

    for (let i = 0; i < 20; i += 1) {
      channel.registerSendFailure(3);
    }

    expect(channel.status).toBe(ChannelStatus.DEGRADED);
    expect(channel.isTerminal).toBe(false);
    expect(allowsSenderMigration(channel.status)).toBe(false);
  });

  it('a success clears the streak', () => {
    const channel = connected();
    channel.registerSendFailure(3);
    channel.registerSendFailure(3);

    channel.registerSendSuccess();

    expect(channel.consecutiveFailures).toBe(0);
    expect(channel.lastSendAt).toBeInstanceOf(Date);
  });

  it('a healthy reconnection clears the streak too', () => {
    const channel = connected();
    channel.registerSendFailure(10);
    channel.markDisconnected();

    channel.markConnected();

    expect(channel.consecutiveFailures).toBe(0);
  });

  it('degrading drops the quota to the floor', () => {
    const channel = connected(20, 150);
    channel.applyThrottleDecision(ThrottleDecision.RAISE, 'limpo', FACTORS);
    expect(channel.quota.current).toBeGreaterThan(20);

    channel.degrade('falhas consecutivas');

    expect(channel.quota.current).toBe(20);
  });
});

describe('Channel — reinstate', () => {
  it('returns a DEGRADED channel as DISCONNECTED, not CONNECTED', () => {
    const channel = connected();
    channel.degrade('pausa automática');

    channel.reinstate();

    // The real state is whatever the instance reports next; claiming CONNECTED would be a guess.
    expect(channel.status).toBe(ChannelStatus.DISCONNECTED);
    expect(channel.consecutiveFailures).toBe(0);
  });

  it('refuses to reinstate a channel that is not degraded', () => {
    const channel = connected();

    expect(() => channel.reinstate()).toThrow(InvalidChannelTransitionException);
  });
});

describe('Channel — quota ownership', () => {
  it('the operator changes the band and cannot set the current value', () => {
    const channel = connected(20, 150);
    channel.applyThrottleDecision(ThrottleDecision.RAISE, 'limpo', FACTORS);
    const earned = channel.quota.current;

    channel.changeQuotaBand(10, 300);

    // Raising the ceiling must not hand the channel a jump it did not earn.
    expect(channel.quota.current).toBe(earned);
    expect(channel.quota.ceiling).toBe(300);
    // And there is no setter for the current value on the entity at all.
    expect(Object.getOwnPropertyNames(Channel.prototype)).not.toContain('setCurrentQuota');
  });

  it('lowering the ceiling below the current value takes effect immediately', () => {
    const channel = connected(20, 150);
    channel.applyThrottleDecision(ThrottleDecision.RAISE, 'limpo', FACTORS);

    channel.changeQuotaBand(5, 10);

    expect(channel.quota.current).toBe(10);
  });

  it('records the review timestamp even on HOLD', () => {
    const channel = connected();

    channel.applyThrottleDecision(ThrottleDecision.HOLD, 'amostra insuficiente', FACTORS);

    expect(channel.lastQuotaReviewAt).toBeInstanceOf(Date);
    expect(channel.pullDomainEvents()).toHaveLength(0);
  });

  it('emits a quota-adjusted event only when the number moved', () => {
    const channel = connected(20, 150);

    channel.applyThrottleDecision(ThrottleDecision.RAISE, 'limpo', FACTORS);
    const events = channel.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('channel.quota_adjusted');
  });

  it('PAUSE degrades the channel', () => {
    const channel = connected();

    channel.applyThrottleDecision(ThrottleDecision.PAUSE, 'instabilidade', FACTORS);

    expect(channel.status).toBe(ChannelStatus.DEGRADED);
    expect(channel.pullDomainEvents().map((e) => e.eventName)).toContain('channel.degraded');
  });
});
