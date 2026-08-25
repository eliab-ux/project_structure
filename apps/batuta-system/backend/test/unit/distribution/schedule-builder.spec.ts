import {
  ChannelPlanInput,
  ScheduleRules,
  buildSchedule,
} from '../../../src/contexts/distribution/domain/services/schedule-builder';
import { localDateKey, zonedParts } from '../../../src/shared/domain/services/zoned-time';

const TZ = 'America/Sao_Paulo';

/** Sao Paulo is UTC-3 year round since 2019, so 12:00Z is 09:00 local — inside quiet hours. */
const NOON_UTC = new Date('2026-08-04T12:00:00Z');

function rules(overrides: Partial<ScheduleRules> = {}): ScheduleRules {
  return {
    timeZone: TZ,
    quietHoursStart: 8,
    quietHoursEnd: 21,
    minIntervalSeconds: 45,
    maxIntervalSeconds: 120,
    maxPerHourPerChannel: 30,
    replyReserveRatio: 0.2,
    accountDailyCeiling: 10_000,
    accountSendsToday: 0,
    ...overrides,
  };
}

function channel(id: string, contacts: number, quota = 100, sentToday = 0): ChannelPlanInput {
  return {
    channelId: id,
    contactIds: Array.from({ length: contacts }, (_, index) => `${id}-c${index}`),
    dailyQuota: quota,
    campaignSendsToday: sentToday,
  };
}

/** Fixed jitter so a test asserts on spacing without asserting on luck. */
const midJitter = (): number => 0.5;

describe('buildSchedule — the ceilings', () => {
  it('never schedules more per channel per day than the quota minus the reply reserve', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      // One day only.
      windowEnd: new Date('2026-08-04T23:00:00Z'),
      channels: [channel('ch1', 500, 100)],
      rules: rules(),
      random: midJitter,
    });

    // 100 quota − 20% reserve = 80 campaign sends. The reserve is NOT spendable by the campaign.
    expect(plan.sends).toHaveLength(80);
    expect(plan.overflow[0]?.contactIds).toHaveLength(420);
  });

  it('the account ceiling prevails over the sum of the channels (§9.2)', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-04T23:00:00Z'),
      // Three channels could do 3 × 80 = 240, but the account may only do 50.
      channels: [channel('ch1', 200), channel('ch2', 200), channel('ch3', 200)],
      rules: rules({ accountDailyCeiling: 50 }),
      random: midJitter,
    });

    expect(plan.sends).toHaveLength(50);
  });

  it("today's ceiling accounts for what the account already sent", () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-04T23:00:00Z'),
      channels: [channel('ch1', 200)],
      rules: rules({ accountDailyCeiling: 100, accountSendsToday: 90 }),
      random: midJitter,
    });

    expect(plan.sends).toHaveLength(10);
  });

  it("today's channel room accounts for what that channel already sent", () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-04T23:00:00Z'),
      // 80 allowed, 75 already spent today → 5 left.
      channels: [channel('ch1', 200, 100, 75)],
      rules: rules(),
      random: midJitter,
    });

    expect(plan.sends).toHaveLength(5);
  });

  it('spends nothing when the channel is already at its campaign allowance', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-04T23:00:00Z'),
      channels: [channel('ch1', 50, 100, 80)],
      rules: rules(),
      random: midJitter,
    });

    expect(plan.sends).toHaveLength(0);
    expect(plan.overflow[0]?.contactIds).toHaveLength(50);
  });

  it('respects max per hour per channel, jumping to the next hour instead of bursting', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-04T23:00:00Z'),
      channels: [channel('ch1', 60, 100)],
      rules: rules({ maxPerHourPerChannel: 5 }),
      random: midJitter,
    });

    const perHour = new Map<number, number>();
    for (const send of plan.sends) {
      const { hour } = zonedParts(send.scheduledAt, TZ);
      perHour.set(hour, (perHour.get(hour) ?? 0) + 1);
    }
    for (const count of perHour.values()) {
      expect(count).toBeLessThanOrEqual(5);
    }
  });
});

describe('buildSchedule — quiet hours and the window', () => {
  it('never schedules outside quiet hours, in the ACCOUNT timezone', () => {
    const plan = buildSchedule({
      now: new Date('2026-08-04T02:00:00Z'), // 23:00 local the previous day
      windowStart: new Date('2026-08-04T02:00:00Z'),
      windowEnd: new Date('2026-08-08T02:00:00Z'),
      channels: [channel('ch1', 300, 100)],
      rules: rules(),
      random: midJitter,
    });

    expect(plan.sends.length).toBeGreaterThan(0);
    for (const send of plan.sends) {
      const { hour } = zonedParts(send.scheduledAt, TZ);
      expect(hour).toBeGreaterThanOrEqual(8);
      expect(hour).toBeLessThan(21);
    }
  });

  it('a window that is entirely inside quiet hours schedules nothing, and says so', () => {
    const plan = buildSchedule({
      now: new Date('2026-08-05T03:00:00Z'), // 00:00 local
      windowStart: new Date('2026-08-05T03:00:00Z'),
      windowEnd: new Date('2026-08-05T09:00:00Z'), // 06:00 local, still before 08:00
      channels: [channel('ch1', 10, 100)],
      rules: rules(),
      random: midJitter,
    });

    // Nothing scheduled, nothing lost: every contact is in the overflow, which is what the preview
    // reports as "não cabe".
    expect(plan.sends).toHaveLength(0);
    expect(plan.overflow[0]?.contactIds).toHaveLength(10);
  });

  it('never schedules past window_end', () => {
    const end = new Date('2026-08-04T16:00:00Z');
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: end,
      channels: [channel('ch1', 500, 1000)],
      rules: rules(),
      random: midJitter,
    });

    for (const send of plan.sends) {
      expect(send.scheduledAt.getTime()).toBeLessThan(end.getTime());
    }
    expect(plan.overflow.length).toBe(1);
  });

  it('never schedules in the past, even when window_start already passed', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: new Date('2026-08-01T12:00:00Z'), // three days ago
      windowEnd: new Date('2026-08-06T23:00:00Z'),
      channels: [channel('ch1', 30, 100)],
      rules: rules(),
      random: midJitter,
    });

    for (const send of plan.sends) {
      expect(send.scheduledAt.getTime()).toBeGreaterThanOrEqual(NOON_UTC.getTime());
    }
  });
});

describe('buildSchedule — spreading across days', () => {
  it('spills into following days rather than compressing into the first', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-11T23:00:00Z'),
      // 80/day allowed → 240 needs three days.
      channels: [channel('ch1', 240, 100)],
      rules: rules(),
      random: midJitter,
    });

    expect(plan.sends).toHaveLength(240);
    expect(plan.overflow).toHaveLength(0);
    // The first day is short (starts at 09:00 local), so 4 days is the honest answer here.
    expect(plan.estimatedDays).toBeGreaterThanOrEqual(3);
    const days = new Set(plan.sends.map((send) => localDateKey(send.scheduledAt, TZ)));
    expect(days.size).toBe(plan.estimatedDays);
  });

  it('reports the per-day load, which is what "estimativa em dias" is computed from', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-11T23:00:00Z'),
      channels: [channel('ch1', 200, 100)],
      rules: rules(),
      random: midJitter,
    });

    const total = plan.load.reduce((sum, entry) => sum + entry.scheduled, 0);
    expect(total).toBe(plan.sends.length);
    expect(plan.load.every((entry) => entry.scheduled <= entry.accountCapacity)).toBe(true);
  });

  it('a later day gets the FULL allowance, since nothing was spent on it yet', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-06T23:00:00Z'),
      // 78 of today's 80 already spent, so today gives 2 and tomorrow gives 80.
      channels: [channel('ch1', 100, 100, 78)],
      rules: rules(),
      random: midJitter,
    });

    const byDay = new Map<string, number>();
    for (const send of plan.sends) {
      const key = localDateKey(send.scheduledAt, TZ);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    const counts = [...byDay.values()];
    expect(counts[0]).toBe(2);
    expect(counts[1]).toBe(80);
  });
});

describe('buildSchedule — spacing and jitter', () => {
  it('spaces sends of the SAME channel by at least the minimum interval', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-04T23:00:00Z'),
      channels: [channel('ch1', 40, 100)],
      rules: rules({ maxPerHourPerChannel: 1000 }),
      random: () => 0,
    });

    const times = plan.sends.map((send) => send.scheduledAt.getTime()).sort((a, b) => a - b);
    for (let index = 1; index < times.length; index += 1) {
      expect(times[index] - times[index - 1]).toBeGreaterThanOrEqual(45_000);
    }
  });

  it('the interval varies with the jitter — a fixed cadence is the signature of a robot', () => {
    const gaps = (random: () => number): number[] => {
      const plan = buildSchedule({
        now: NOON_UTC,
        windowStart: NOON_UTC,
        windowEnd: new Date('2026-08-04T23:00:00Z'),
        channels: [channel('ch1', 10, 100)],
        rules: rules({ maxPerHourPerChannel: 1000 }),
        random,
      });
      const times = plan.sends.map((send) => send.scheduledAt.getTime()).sort((a, b) => a - b);
      return times.slice(1).map((time, index) => (time - times[index]) / 1000);
    };

    expect(gaps(() => 0).every((gap) => gap === 45)).toBe(true);
    expect(gaps(() => 0.999).every((gap) => gap === 120)).toBe(true);

    // A real sequence mixes them, and never leaves the band.
    let seed = 7;
    const pseudo = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const varied = gaps(pseudo);
    expect(new Set(varied).size).toBeGreaterThan(1);
    expect(varied.every((gap) => gap >= 45 && gap <= 120)).toBe(true);
  });

  it('interleaves channels instead of draining one before starting the next', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-04T23:00:00Z'),
      channels: [channel('ch1', 10, 100), channel('ch2', 10, 100)],
      rules: rules(),
      random: midJitter,
    });

    const order = plan.sends.map((send) => send.channelId);
    // Both chips work through the day rather than one firing for an hour and the other idling.
    expect(order.slice(0, 4)).toEqual(['ch1', 'ch2', 'ch1', 'ch2']);
  });
});

describe('buildSchedule — overflow is reported, never truncated', () => {
  it('returns every contact that did not fit, with its channel', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-04T23:00:00Z'),
      channels: [channel('ch1', 100, 20), channel('ch2', 100, 20)],
      rules: rules(),
      random: midJitter,
    });

    // 20 quota − 20% = 16 per channel.
    expect(plan.sends).toHaveLength(32);
    const overflowTotal = plan.overflow.reduce((sum, entry) => sum + entry.contactIds.length, 0);
    expect(overflowTotal).toBe(168);
    // Nothing is lost: every contact is either scheduled or in the overflow.
    expect(plan.sends.length + overflowTotal).toBe(200);
  });

  it('per-channel numbers add up to the totals', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-05T23:00:00Z'),
      channels: [channel('ch1', 50, 30), channel('ch2', 70, 60)],
      rules: rules(),
      random: midJitter,
    });

    for (const entry of plan.perChannel) {
      const contacts = entry.scheduled + entry.overflow;
      expect(contacts).toBe(entry.channelId === 'ch1' ? 50 : 70);
      expect(entry.firstDayLoad).toBeLessThanOrEqual(entry.scheduled);
    }
  });

  it('no channels means no sends and no crash', () => {
    const plan = buildSchedule({
      now: NOON_UTC,
      windowStart: NOON_UTC,
      windowEnd: new Date('2026-08-05T23:00:00Z'),
      channels: [],
      rules: rules(),
      random: midJitter,
    });

    expect(plan.sends).toHaveLength(0);
    expect(plan.overflow).toHaveLength(0);
    expect(plan.estimatedDays).toBe(0);
  });
});
