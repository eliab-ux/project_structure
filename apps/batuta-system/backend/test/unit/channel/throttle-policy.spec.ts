import {
  ChannelDaySignals,
  ThrottleThresholds,
  evaluateThrottle,
} from '../../../src/contexts/channel/domain/services/throttle-policy';
import { ThrottleDecision } from '../../../src/contexts/channel/domain/value-objects/throttle-decision.vo';
import { QuotaBand } from '../../../src/contexts/channel/domain/value-objects/quota-band.vo';

/** The provisional configuration of §14 items 1–3, as ThrottleConfig would supply it. */
const THRESHOLDS: ThrottleThresholds = {
  evaluationWindowDays: 3,
  cleanDaysForRaise: 3,
  severeFailureRate: 0.2,
  severeDisconnectEvents: 3,
  lowDeliveryRate: 0.85,
  highOptOutRate: 0.02,
  raiseFactor: 1.2,
  lowerFactor: 0.5,
  minSampleForDecision: 20,
};

function day(overrides: Partial<ChannelDaySignals> = {}): ChannelDaySignals {
  return {
    date: '2026-08-01',
    sentCount: 100,
    failedCount: 0,
    deliveredCount: 98,
    optOutCount: 0,
    inboundCount: 12,
    disconnectEvents: 0,
    ...overrides,
  };
}

function cleanDays(count: number): ChannelDaySignals[] {
  return Array.from({ length: count }, (_, i) => day({ date: `2026-08-0${i + 1}` }));
}

describe('evaluateThrottle — PAUSE', () => {
  it('pauses on connection instability, even with no sends at all', () => {
    const result = evaluateThrottle(
      [day({ sentCount: 0, deliveredCount: 0, disconnectEvents: 3 })],
      THRESHOLDS,
    );

    // A flapping instance is a problem regardless of volume, so this is checked before any rate.
    expect(result.decision).toBe(ThrottleDecision.PAUSE);
    expect(result.reason).toMatch(/Instabilidade de conexão/);
  });

  it('pauses on a severe failure rate', () => {
    const result = evaluateThrottle(
      [day({ sentCount: 100, failedCount: 25, deliveredCount: 75 })],
      THRESHOLDS,
    );

    expect(result.decision).toBe(ThrottleDecision.PAUSE);
    expect(result.reason).toMatch(/Falha grave/);
  });

  it('does not pause exactly AT the failure threshold', () => {
    const result = evaluateThrottle(
      [day({ sentCount: 100, failedCount: 20, deliveredCount: 90 })],
      THRESHOLDS,
    );

    expect(result.decision).not.toBe(ThrottleDecision.PAUSE);
  });
});

describe('evaluateThrottle — LOWER', () => {
  it('lowers when delivery falls below the threshold (main proxy for blocks)', () => {
    const result = evaluateThrottle([day({ sentCount: 100, deliveredCount: 80 })], THRESHOLDS);

    expect(result.decision).toBe(ThrottleDecision.LOWER);
    expect(result.reason).toMatch(/Entrega abaixo do limiar/);
  });

  it('lowers when opt-out rises above the threshold', () => {
    const result = evaluateThrottle(
      [day({ sentCount: 100, deliveredCount: 98, optOutCount: 3 })],
      THRESHOLDS,
    );

    expect(result.decision).toBe(ThrottleDecision.LOWER);
    expect(result.reason).toMatch(/Opt-out acima do limiar/);
  });

  it('a serious failure outranks a low delivery rate', () => {
    const result = evaluateThrottle(
      [day({ sentCount: 100, failedCount: 30, deliveredCount: 10 })],
      THRESHOLDS,
    );

    expect(result.decision).toBe(ThrottleDecision.PAUSE);
  });
});

describe('evaluateThrottle — RAISE', () => {
  it('raises after N consecutive clean days', () => {
    const result = evaluateThrottle(cleanDays(3), THRESHOLDS);

    expect(result.decision).toBe(ThrottleDecision.RAISE);
    expect(result.reason).toMatch(/Sinais limpos por 3 dia/);
  });

  it('holds with fewer clean days than required', () => {
    const result = evaluateThrottle(cleanDays(2), THRESHOLDS);

    expect(result.decision).toBe(ThrottleDecision.HOLD);
    expect(result.reason).toMatch(/2 de 3 dia/);
  });

  it('a single bad day breaks the streak', () => {
    const history = [
      day({ date: '2026-08-01' }),
      day({ date: '2026-08-02', deliveredCount: 70 }),
      day({ date: '2026-08-03' }),
    ];

    const result = evaluateThrottle(history, THRESHOLDS);

    expect(result.decision).not.toBe(ThrottleDecision.RAISE);
  });

  it('does NOT require inbound to raise', () => {
    // Gating RAISE on inbound would freeze every ramp until FASE 8 exists to produce inbound.
    const result = evaluateThrottle(
      cleanDays(3).map((d) => ({ ...d, inboundCount: 0 })),
      THRESHOLDS,
    );

    expect(result.decision).toBe(ThrottleDecision.RAISE);
    expect(result.metrics.inboundRate).toBe(0);
  });
});

describe('evaluateThrottle — sample size', () => {
  it('HOLDS instead of pausing on a tiny sample', () => {
    // 1 failure out of 3 sends is a 33% failure rate — noise, not a verdict.
    const result = evaluateThrottle(
      [day({ sentCount: 3, failedCount: 1, deliveredCount: 2 })],
      THRESHOLDS,
    );

    expect(result.decision).toBe(ThrottleDecision.HOLD);
    expect(result.reason).toMatch(/Amostra insuficiente/);
  });

  it('HOLDS a brand-new channel with no history', () => {
    const result = evaluateThrottle([], THRESHOLDS);

    expect(result.decision).toBe(ThrottleDecision.HOLD);
    expect(result.metrics.daysConsidered).toBe(0);
  });

  it('HOLDS while FASE 7 has not started writing deliveries', () => {
    // Everything zero except sends is exactly the FASE 2 shape: no data, so no decision.
    const result = evaluateThrottle(
      [day({ sentCount: 0, deliveredCount: 0, inboundCount: 0 })],
      THRESHOLDS,
    );

    expect(result.decision).toBe(ThrottleDecision.HOLD);
  });

  it('still pauses on instability below the sample size', () => {
    const result = evaluateThrottle(
      [day({ sentCount: 2, deliveredCount: 2, disconnectEvents: 4 })],
      THRESHOLDS,
    );

    expect(result.decision).toBe(ThrottleDecision.PAUSE);
  });
});

describe('evaluateThrottle — window', () => {
  it('considers only the last N days with activity', () => {
    const history = [day({ date: '2026-07-20', deliveredCount: 10 }), ...cleanDays(3)];

    const result = evaluateThrottle(history, THRESHOLDS);

    // The bad day is outside the 3-day window, so it must not hold the channel back forever.
    expect(result.metrics.daysConsidered).toBe(3);
    expect(result.decision).toBe(ThrottleDecision.RAISE);
  });

  it('skips days with no activity at all', () => {
    const history = [
      day({ date: '2026-08-01', sentCount: 0, deliveredCount: 0, inboundCount: 0 }),
      day({ date: '2026-08-02' }),
    ];

    const result = evaluateThrottle(history, THRESHOLDS);

    expect(result.metrics.daysConsidered).toBe(1);
  });

  it('reports rates as null when there were no sends, not as zero', () => {
    const result = evaluateThrottle(
      [day({ sentCount: 0, deliveredCount: 0, inboundCount: 0, disconnectEvents: 1 })],
      THRESHOLDS,
    );

    expect(result.metrics.deliveryRate).toBeNull();
    expect(result.metrics.failureRate).toBeNull();
    expect(result.metrics.optOutRate).toBeNull();
  });
});

describe('QuotaBand — asymmetry and bounds', () => {
  it('rises gradually and stops at the ceiling', () => {
    let band = QuotaBand.create(20, 30, 20);

    band = band.raisedBy(1.2);
    expect(band.current).toBe(24);

    band = band.raisedBy(1.2);
    expect(band.current).toBe(28);

    band = band.raisedBy(1.2);
    expect(band.current).toBe(30);
    expect(band.isAtCeiling).toBe(true);

    band = band.raisedBy(1.2);
    expect(band.current).toBe(30);
  });

  it('falls aggressively and stops at the floor', () => {
    let band = QuotaBand.create(20, 200, 200);

    band = band.loweredBy(0.5);
    expect(band.current).toBe(100);

    band = band.loweredBy(0.5);
    expect(band.current).toBe(50);

    band = band.loweredBy(0.5);
    expect(band.current).toBe(25);

    band = band.loweredBy(0.5);
    expect(band.current).toBe(20);
    expect(band.isAtFloor).toBe(true);
  });

  it('a LOWER always moves by at least one, never a silent no-op', () => {
    const band = QuotaBand.create(1, 100, 3);

    expect(band.loweredBy(0.9).current).toBe(2);
  });

  it('a RAISE always moves by at least one', () => {
    const band = QuotaBand.create(1, 100, 3);

    expect(band.raisedBy(1.01).current).toBe(4);
  });

  it('recovery from the floor is slower than the fall was — that is the point', () => {
    let band = QuotaBand.create(20, 150, 150);
    const beforeTheDrop = band.current;

    band = band.loweredBy(0.5);

    let raises = 0;
    while (band.current < beforeTheDrop && raises < 20) {
      band = band.raisedBy(1.2);
      raises += 1;
    }

    // One bad day costs several good ones to undo.
    expect(raises).toBeGreaterThan(1);
  });

  it('refuses an invalid band', () => {
    expect(() => QuotaBand.create(0, 100)).toThrow();
    expect(() => QuotaBand.create(100, 50)).toThrow();
    expect(() => QuotaBand.create(1.5, 100)).toThrow();
  });

  it('clamps a stored value that sits outside the band', () => {
    // Defence against a bad write from outside the domain.
    expect(QuotaBand.create(20, 100, 500).current).toBe(100);
    expect(QuotaBand.create(20, 100, 1).current).toBe(20);
  });
});
