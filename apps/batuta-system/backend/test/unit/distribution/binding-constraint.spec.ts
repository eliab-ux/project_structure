import {
  ChannelPlanInput,
  ScheduleRules,
  buildSchedule,
} from '../../../src/contexts/distribution/domain/services/schedule-builder';
import { explainBindingConstraint } from '../../../src/contexts/distribution/domain/services/binding-constraint-explainer';

const TZ = 'America/Sao_Paulo';

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

function channel(overrides: Partial<ChannelPlanInput> = {}): ChannelPlanInput {
  return {
    channelId: 'ch-1',
    contactIds: Array.from({ length: 200 }, (_, i) => `c-${i}`),
    dailyQuota: 1000,
    campaignSendsToday: 0,
    ...overrides,
  };
}

/** Local noon, so a one-hour window sits comfortably inside 08:00–21:00. */
function at(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 7, 10, hour + 3, minute));
}

/**
 * Adendo 02 §3: the preview must say WHICH ceiling bound.
 *
 * The cost of not saying it, from §3.1: the client adds a chip expecting more throughput, sees no gain
 * because the ACCOUNT ceiling was binding, and concludes the system is broken. And from real use: a
 * preview said "6 contatos não cabem nesta janela" when the chip's daily quota was spent (15 of 16) —
 * the operator concluded the system cannot send 6 messages in an hour, which is a reasonable inference
 * from a wrong explanation, and a wrong belief about the one mechanism the product exists to protect.
 */
describe('buildSchedule — binding constraint', () => {
  it('names CHANNEL_QUOTA and the room left, reproducing the case from production', () => {
    // The exact shape: quota 20, reserve 20% → allowance 16, 15 already spent, 7 contacts, 1h window.
    const plan = buildSchedule({
      now: at(12),
      windowStart: at(12),
      windowEnd: at(13),
      channels: [
        channel({
          contactIds: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
          dailyQuota: 20,
          campaignSendsToday: 15,
        }),
      ],
      rules: rules(),
      random: () => 0,
    });

    expect(plan.sends).toHaveLength(1);
    expect(plan.overflow[0].contactIds).toHaveLength(6);
    expect(plan.binding.constraint).toBe('CHANNEL_QUOTA');
    expect(plan.binding.capacityFirstDay).toBe(1);
    // The other half of the answer: the remainder had nowhere to go because the window ends today.
    expect(plan.binding.windowExhausted).toBe(true);
  });

  it('names ACCOUNT_CEILING when it is tighter than the channels', () => {
    const plan = buildSchedule({
      now: at(12),
      windowStart: at(12),
      windowEnd: at(13),
      channels: [channel({ dailyQuota: 1000 })],
      rules: rules({ accountDailyCeiling: 5 }),
      random: () => 0,
    });

    expect(plan.binding.constraint).toBe('ACCOUNT_CEILING');
    expect(plan.binding.capacityFirstDay).toBe(5);
  });

  it('blames ACCOUNT_CEILING on a tie, never the channels', () => {
    // The tie rule earns its keep here: blaming the channels would send the operator to buy chips that
    // change nothing, which is precisely the failure §3.1 describes.
    const plan = buildSchedule({
      now: at(12),
      windowStart: at(12),
      windowEnd: at(20),
      channels: [channel({ dailyQuota: 10, campaignSendsToday: 0 })],
      // Channel allowance = floor(10 * 0.8) = 8. Account ceiling also 8.
      rules: rules({ accountDailyCeiling: 8 }),
      random: () => 0,
    });

    expect(plan.binding.capacityFirstDay).toBe(8);
    expect(plan.binding.constraint).toBe('ACCOUNT_CEILING');
  });

  it('names WINDOW when the window is what closes the day short', () => {
    // Ten minutes at a 45s minimum interval: the time available is the tightest ceiling by far.
    const plan = buildSchedule({
      now: at(12),
      windowStart: at(12),
      windowEnd: at(12, 10),
      channels: [channel({ dailyQuota: 1000 })],
      rules: rules(),
      random: () => 0,
    });

    expect(plan.binding.constraint).toBe('WINDOW');
    expect(plan.binding.capacityFirstDay).toBeLessThan(20);
  });

  it('names HOURLY_CAP when the hours are there but each one is capped', () => {
    // Five allowed hours × 30/hour = 150, while the 45s interval would allow ~400. The cap is the wall,
    // and Adendo 02 §4 predicted this is rare in practice — hence exposed, not expected.
    const plan = buildSchedule({
      now: at(12),
      windowStart: at(12),
      windowEnd: new Date(Date.UTC(2026, 7, 20, 0, 0)),
      channels: [channel({ dailyQuota: 1000 })],
      rules: rules({ quietHoursStart: 8, quietHoursEnd: 13 }),
      random: () => 0,
    });

    expect(plan.binding.constraint).toBe('HOURLY_CAP');
    // 30 and not 150: the FIRST day starts at noon and the band closes at 13:00, so one bucket.
    expect(plan.binding.capacityFirstDay).toBe(30);
  });

  it('names QUIET_HOURS when the allowed band is what limits the day', () => {
    // A long interval takes the hourly cap out of play, leaving the narrow allowed band as the ceiling.
    const plan = buildSchedule({
      now: at(12),
      windowStart: at(12),
      windowEnd: new Date(Date.UTC(2026, 7, 20, 0, 0)),
      channels: [channel({ dailyQuota: 1000 })],
      rules: rules({
        quietHoursStart: 8,
        quietHoursEnd: 13,
        minIntervalSeconds: 900,
        maxIntervalSeconds: 1200,
      }),
      random: () => 0,
    });

    expect(plan.binding.constraint).toBe('QUIET_HOURS');
  });

  it('does not claim the window was exhausted when everything fitted', () => {
    const plan = buildSchedule({
      now: at(12),
      windowStart: at(12),
      windowEnd: new Date(Date.UTC(2026, 7, 20, 0, 0)),
      channels: [channel({ contactIds: ['a', 'b'], dailyQuota: 1000 })],
      rules: rules(),
      random: () => 0,
    });

    expect(plan.overflow).toHaveLength(0);
    expect(plan.binding.windowExhausted).toBe(false);
  });

  it('reports WINDOW for a window that never opens a day', () => {
    const plan = buildSchedule({
      now: at(12),
      windowStart: at(12),
      windowEnd: at(12),
      channels: [channel({ contactIds: ['a'] })],
      rules: rules(),
      random: () => 0,
    });

    expect(plan.sends).toHaveLength(0);
    expect(plan.binding.constraint).toBe('WINDOW');
  });
});

describe('explainBindingConstraint', () => {
  const facts = {
    overflowCount: 6,
    channelCount: 1,
    sentToday: 15,
    allowanceToday: 16,
    accountDailyCeiling: 10_000,
  };

  it('states the quota numbers instead of blaming the window', () => {
    const explained = explainBindingConstraint(
      { constraint: 'CHANNEL_QUOTA', capacityFirstDay: 1, windowExhausted: true },
      facts,
    );

    expect(explained.reason).toMatch(/cota diária/);
    expect(explained.reason).toMatch(/15 de 16/);
    // And explains why the rest did not simply roll over to tomorrow.
    expect(explained.reason).toMatch(/janela termina antes/);
    expect(explained.options[0]).toMatch(/Estender o fim da janela/);
  });

  it('warns that adding channels does NOT help under an account ceiling', () => {
    // §3.1 in one assertion: this sentence is the difference between an operator understanding the
    // system and an operator buying chips that change nothing.
    const explained = explainBindingConstraint(
      { constraint: 'ACCOUNT_CEILING', capacityFirstDay: 5, windowExhausted: false },
      facts,
    );

    expect(explained.reason).toMatch(/não aumenta a vazão/);
    expect(explained.options.join(' ')).not.toMatch(/Adicionar ou reconectar canais/);
  });

  it('offers raising the quota floor WITH its cost, never as a free win', () => {
    const explained = explainBindingConstraint(
      { constraint: 'CHANNEL_QUOTA', capacityFirstDay: 1, windowExhausted: false },
      facts,
    );

    const floorOption = explained.options.find((option) => option.includes('piso'));
    expect(floorOption).toMatch(/encurta o aquecimento/);
  });

  it('suggests more hours per day — not more days — for the hourly cap', () => {
    const explained = explainBindingConstraint(
      { constraint: 'HOURLY_CAP', capacityFirstDay: 30, windowExhausted: false },
      facts,
    );

    expect(explained.options[0]).toMatch(/Ampliar a janela diária/);
  });

  it('covers every constraint with a reason and at least one option', () => {
    // A missing branch would surface as an empty alert on the screen, which is worse than the generic
    // text it replaced.
    const all = [
      'ACCOUNT_CEILING',
      'CHANNEL_QUOTA',
      'HOURLY_CAP',
      'WINDOW',
      'QUIET_HOURS',
    ] as const;

    for (const constraint of all) {
      const explained = explainBindingConstraint(
        { constraint, capacityFirstDay: 3, windowExhausted: false },
        facts,
      );
      expect(explained.reason.length).toBeGreaterThan(20);
      expect(explained.options.length).toBeGreaterThan(0);
    }
  });
});
