import {
  addLocalDays,
  localDateKey,
  localHourOn,
  zonedParts,
} from '../../../../shared/domain/services/zoned-time';

/** One channel's share of the plan: its recipients, its quota, and what it already spent today. */
export interface ChannelPlanInput {
  channelId: string;
  /** Contact ids, in the order they should be served. Stable ordering keeps plans reproducible. */
  contactIds: readonly string[];
  /** `channels.current_quota` — the throttle owns this number, the planner only reads it. */
  dailyQuota: number;
  /** `channel_daily_counters.campaign_sends` for today, in the account's timezone. */
  campaignSendsToday: number;
}

export interface ScheduleRules {
  timeZone: string;
  /** Local hour sends may start (inclusive). §14 item 6. */
  quietHoursStart: number;
  /** Local hour sends must stop by (exclusive). §14 item 6. */
  quietHoursEnd: number;
  minIntervalSeconds: number;
  maxIntervalSeconds: number;
  maxPerHourPerChannel: number;
  /** Share of each channel's daily quota held back for inbox replies. §9.2, §14 item 4. */
  replyReserveRatio: number;
  /** `accounts.daily_send_ceiling` — prevails over the sum of the channels (§9.2). */
  accountDailyCeiling: number;
  /** Campaign sends already made today by the WHOLE account. */
  accountSendsToday: number;
}

export interface ScheduleInput {
  now: Date;
  windowStart: Date;
  windowEnd: Date;
  channels: readonly ChannelPlanInput[];
  rules: ScheduleRules;
  /** Injected so tests are deterministic; production passes `Math.random`. */
  random: () => number;
}

export interface ScheduledSend {
  contactId: string;
  channelId: string;
  scheduledAt: Date;
}

export interface ChannelOverflow {
  channelId: string;
  /** Contacts that did not fit in the window. NEVER dropped silently (§9.2). */
  contactIds: string[];
}

export interface DayLoad {
  /** `YYYY-MM-DD` in the account's timezone. */
  date: string;
  scheduled: number;
  /** What the account ceiling allowed on that day, after what was already spent. */
  accountCapacity: number;
}

/**
 * Which ceiling actually limited the plan (Adendo 02 §3.2).
 *
 * Five ceilings apply in cascade and the operator sees only the outcome, so the wrong one gets blamed.
 * The adendo names the real cost: the client adds a chip expecting more throughput, sees no gain —
 * because the ACCOUNT ceiling was binding all along — and concludes the system is broken.
 */
export type BindingConstraint =
  'ACCOUNT_CEILING' | 'CHANNEL_QUOTA' | 'HOURLY_CAP' | 'WINDOW' | 'QUIET_HOURS';

export interface BindingConstraintReport {
  constraint: BindingConstraint;
  /**
   * Sends the binding ceiling allowed on the plan's FIRST day.
   *
   * The first day and not a steady-state average, deliberately: it is the day the operator is looking
   * at, the one that produced "vão receber: N", and the only one whose already-spent counters are real.
   * A later day may carry more — the first day usually starts mid-afternoon, not at the top of the
   * allowed band — so this number must not be read as the campaign's daily throughput.
   */
  capacityFirstDay: number;
  /**
   * True when what did not fit had nowhere left to go: the window ended before another day opened.
   *
   * Reported separately from `constraint` because they answer different questions. The constraint says
   * why throughput is what it is; this says why the remainder was not simply pushed to tomorrow. A plan
   * can be bound by the channel quota and still cover everyone — given enough days.
   */
  windowExhausted: boolean;
}

export interface SchedulePlan {
  sends: ScheduledSend[];
  overflow: ChannelOverflow[];
  /** Per-day totals, for the preview's "estimativa de conclusão em dias". */
  load: DayLoad[];
  /** Calendar days the plan actually occupies. */
  estimatedDays: number;
  /** Per channel: how many fitted, and the quota that will be consumed on the first day. */
  perChannel: { channelId: string; scheduled: number; overflow: number; firstDayLoad: number }[];
  /** Which ceiling bound, and whether the window ran out of days (Adendo 02 §3). */
  binding: BindingConstraintReport;
}

/**
 * Spreads a set of sends across a window, respecting every ceiling at once (§9.2).
 *
 * A pure function on purpose: this is the part of the system whose mistakes are expensive and
 * invisible — an off-by-one here does not crash, it burns a chip. Pure means the whole thing is
 * testable without a database, a clock, or a queue, and `random` is a parameter so a test can pin the
 * jitter and still exercise it.
 *
 * The ceilings, and the order they bind in:
 *  1. **quiet hours** — no send outside the account's local daytime, ever;
 *  2. **the window** — nothing before `window_start`, nothing after `window_end`;
 *  3. **channel quota minus the reply reserve** — the campaign never spends the inbox's share, because
 *     a reply held for hours to respect a send interval defeats the purpose (§10.4);
 *  4. **max per hour per channel** — bursts look like automation even inside a legal daily total;
 *  5. **the account ceiling** — which "prevalece sobre a soma dos canais", so it is applied across
 *     channels per day, not per channel.
 *
 * What does NOT fit comes back as `overflow`, with the contact ids. Truncating silently would be the
 * worst possible failure mode: the operator would believe a base was covered when a third of it never
 * received anything.
 *
 * Note what this function deliberately does NOT do: predict the throttle. It plans with today's
 * `current_quota` for every day of the window. The quota may rise (warm-up) or fall (bad signals)
 * while the campaign runs, and pretending to know which would produce a schedule that reads as a
 * promise. The execution phase re-validates every send against the quota of the day it actually runs.
 */
export function buildSchedule(input: ScheduleInput): SchedulePlan {
  const { rules } = input;
  const start = input.windowStart.getTime() > input.now.getTime() ? input.windowStart : input.now;

  const cursors = new Map<string, ChannelCursor>();
  const remaining = new Map<string, string[]>();
  for (const channel of input.channels) {
    cursors.set(channel.channelId, { hourBucket: null, hourCount: 0, nextAt: null });
    remaining.set(channel.channelId, [...channel.contactIds]);
  }

  const sends: ScheduledSend[] = [];
  const load: DayLoad[] = [];

  let day = 0;
  // A window can legitimately span weeks (§15 risco 3: a 10k base takes about a week). The bound is a
  // guard against a malformed window, not a product limit.
  const MAX_DAYS = 400;

  /** Capacities of the FIRST day, kept so the binding ceiling can be named afterwards. */
  let firstDayCapacities: DayCapacities | null = null;
  /** The loop stopped because the window had no further day, not because everything fitted. */
  let stoppedAtWindowEnd = false;

  while (day < MAX_DAYS) {
    const dayAnchor = day === 0 ? start : addLocalDays(start, rules.timeZone, day);
    if (dayAnchor.getTime() > input.windowEnd.getTime()) {
      stoppedAtWindowEnd = true;
      break;
    }
    if (totalRemaining(remaining) === 0) {
      break;
    }

    const dateKey = localDateKey(dayAnchor, rules.timeZone);
    const dayOpen = maxDate(localHourOn(dayAnchor, rules.timeZone, rules.quietHoursStart), start);
    const dayClose = minDate(
      localHourOn(dayAnchor, rules.timeZone, rules.quietHoursEnd),
      input.windowEnd,
    );

    // The account's room for this day. Only today has sends already spent against it.
    const accountCapacity = Math.max(
      0,
      rules.accountDailyCeiling - (day === 0 ? rules.accountSendsToday : 0),
    );
    let accountRoom = accountCapacity;

    if (firstDayCapacities === null) {
      firstDayCapacities = capacitiesForDay({
        channels: input.channels,
        rules,
        isToday: day === 0,
        dayOpen,
        dayClose,
        // Which of the two closed the day decides between WINDOW and QUIET_HOURS.
        closedByWindow:
          input.windowEnd.getTime() <
          localHourOn(dayAnchor, rules.timeZone, rules.quietHoursEnd).getTime(),
        accountCapacity,
      });
    }

    if (dayClose.getTime() > dayOpen.getTime() && accountRoom > 0) {
      // Per-channel room for this day, after the reply reserve and today's spend.
      const room = new Map<string, number>();
      for (const channel of input.channels) {
        room.set(channel.channelId, channelRoomForDay(channel, rules, day === 0));
        const cursor = cursors.get(channel.channelId);
        if (cursor) {
          cursor.nextAt = null;
          cursor.hourBucket = null;
          cursor.hourCount = 0;
        }
      }

      // Round-robin across channels rather than draining one at a time: it keeps every chip's traffic
      // spread through the day instead of one chip firing for two hours and the rest idle.
      let progress = true;
      while (progress && accountRoom > 0) {
        progress = false;
        for (const channel of input.channels) {
          if (accountRoom <= 0) {
            break;
          }
          const queue = remaining.get(channel.channelId);
          const channelRoom = room.get(channel.channelId) ?? 0;
          if (!queue || queue.length === 0 || channelRoom <= 0) {
            continue;
          }

          const cursor = cursors.get(channel.channelId);
          if (!cursor) {
            continue;
          }

          const at = nextSlot(cursor, dayOpen, dayClose, rules, input.random);
          if (!at) {
            // No more room in this day for this channel: its hour buckets or the day are exhausted.
            room.set(channel.channelId, 0);
            continue;
          }

          const contactId = queue.shift() as string;
          sends.push({ contactId, channelId: channel.channelId, scheduledAt: at });
          room.set(channel.channelId, channelRoom - 1);
          accountRoom -= 1;
          progress = true;
        }
      }
    }

    load.push({ date: dateKey, scheduled: accountCapacity - accountRoom, accountCapacity });
    day += 1;
  }

  const overflow: ChannelOverflow[] = [];
  for (const [channelId, queue] of remaining) {
    if (queue.length > 0) {
      overflow.push({ channelId, contactIds: queue });
    }
  }

  const firstDate = load[0]?.date;
  const perChannel = input.channels.map((channel) => ({
    channelId: channel.channelId,
    scheduled: sends.filter((send) => send.channelId === channel.channelId).length,
    overflow: remaining.get(channel.channelId)?.length ?? 0,
    firstDayLoad: firstDate
      ? sends.filter(
          (send) =>
            send.channelId === channel.channelId &&
            localDateKey(send.scheduledAt, rules.timeZone) === firstDate,
        ).length
      : 0,
  }));

  return {
    sends,
    overflow,
    load: load.filter((entry) => entry.scheduled > 0),
    estimatedDays: new Set(sends.map((send) => localDateKey(send.scheduledAt, rules.timeZone)))
      .size,
    perChannel,
    binding: nameBindingConstraint(
      firstDayCapacities,
      stoppedAtWindowEnd && overflow.length > 0,
      input,
    ),
  };
}

/** What each ceiling allowed on one day, all in the same unit: sends. */
interface DayCapacities {
  accountCeiling: number;
  channelQuota: number;
  hourlyCap: number;
  /** Sends the available TIME allows, at the minimum interval. */
  time: number;
  /** Whether the day's end came from `window_end` rather than from the quiet-hours boundary. */
  closedByWindow: boolean;
}

function capacitiesForDay(args: {
  channels: readonly ChannelPlanInput[];
  rules: ScheduleRules;
  isToday: boolean;
  dayOpen: Date;
  dayClose: Date;
  closedByWindow: boolean;
  accountCapacity: number;
}): DayCapacities {
  const { channels, rules, isToday, dayOpen, dayClose, closedByWindow, accountCapacity } = args;

  const seconds = Math.max(0, (dayClose.getTime() - dayOpen.getTime()) / 1000);
  const hours = seconds / 3600;
  const channelCount = Math.max(1, channels.length);

  const channelQuota = channels.reduce(
    (total, channel) => total + channelRoomForDay(channel, rules, isToday),
    0,
  );

  // Both time-based ceilings scale with the number of channels: they send in parallel.
  // `+ 1` on the interval count because the first send happens at the top of the window, not after
  // one interval — off by one here would understate capacity by one send per channel per day.
  const perChannelBySeconds =
    seconds > 0 ? Math.floor(seconds / Math.max(1, rules.minIntervalSeconds)) + 1 : 0;

  // The per-hour cap counts BUCKETS, not a rate. `nextSlot` allows up to `maxPerHourPerChannel` inside
  // each clock hour and then jumps to the next one — so ten minutes carry up to the full cap, not a
  // tenth of it. Multiplying the cap by a fractional hour understated a short window badly enough to
  // blame the hourly cap for what was plainly the window.
  const buckets = seconds > 0 ? Math.max(1, Math.ceil(hours)) : 0;

  return {
    accountCeiling: accountCapacity,
    channelQuota,
    hourlyCap: rules.maxPerHourPerChannel * buckets * channelCount,
    time: perChannelBySeconds * channelCount,
    closedByWindow,
  };
}

/**
 * The ceiling with the least room is the one that bound. Ties go to the LATER one in the cascade.
 *
 * The tie rule matters more than it looks. When the channel quota and the account ceiling allow the same
 * number, blaming the channels would send the operator to buy chips that change nothing — the precise
 * failure Adendo 02 §3.1 describes. So the account ceiling, being the one that "prevalece sobre a soma
 * dos canais", wins a tie.
 */
function nameBindingConstraint(
  capacities: DayCapacities | null,
  windowExhausted: boolean,
  input: ScheduleInput,
): BindingConstraintReport {
  if (!capacities) {
    // No day ever opened: the window itself is empty or entirely outside the allowed hours.
    const emptyWindow = input.windowEnd.getTime() <= input.windowStart.getTime();
    return {
      constraint: emptyWindow ? 'WINDOW' : 'QUIET_HOURS',
      capacityFirstDay: 0,
      windowExhausted,
    };
  }

  // Ordered so that a tie resolves to the ceiling the operator can least work around by adding chips.
  const candidates: { constraint: BindingConstraint; capacity: number }[] = [
    { constraint: 'CHANNEL_QUOTA', capacity: capacities.channelQuota },
    { constraint: 'HOURLY_CAP', capacity: capacities.hourlyCap },
    {
      constraint: capacities.closedByWindow ? 'WINDOW' : 'QUIET_HOURS',
      capacity: capacities.time,
    },
    { constraint: 'ACCOUNT_CEILING', capacity: capacities.accountCeiling },
  ];

  let binding = candidates[0];
  for (const candidate of candidates) {
    if (candidate.capacity <= binding.capacity) {
      binding = candidate;
    }
  }

  return {
    constraint: binding.constraint,
    capacityFirstDay: binding.capacity,
    windowExhausted,
  };
}

interface ChannelCursor {
  /** Local `YYYY-MM-DDTHH` of the hour currently being filled. */
  hourBucket: string | null;
  hourCount: number;
  nextAt: Date | null;
}

/**
 * How many campaign sends this channel may still make on this day.
 *
 * The reply reserve is taken off the quota, not off what is left: reserving a share of the remainder
 * would shrink the inbox's allowance every time a campaign ran, which is backwards — the inbox is the
 * priority (§10.4).
 */
function channelRoomForDay(
  channel: ChannelPlanInput,
  rules: ScheduleRules,
  isToday: boolean,
): number {
  const campaignAllowance = Math.floor(channel.dailyQuota * (1 - rules.replyReserveRatio));
  const spent = isToday ? channel.campaignSendsToday : 0;
  return Math.max(0, campaignAllowance - spent);
}

/**
 * The next admissible instant for a channel, or null when the day is spent for it.
 *
 * The interval is `min + random * (max - min)` — the jitter is the point (§9.2): a fixed cadence is
 * the signature of a robot, and the whole reason this system spaces sends at all is that WhatsApp's
 * abuse detection reads regularity.
 */
function nextSlot(
  cursor: ChannelCursor,
  dayOpen: Date,
  dayClose: Date,
  rules: ScheduleRules,
  random: () => number,
): Date | null {
  const spread = Math.max(0, rules.maxIntervalSeconds - rules.minIntervalSeconds);
  const gapSeconds = rules.minIntervalSeconds + Math.floor(random() * (spread + 1));

  let candidate =
    cursor.nextAt === null ? dayOpen : new Date(cursor.nextAt.getTime() + gapSeconds * 1000);

  if (candidate.getTime() < dayOpen.getTime()) {
    candidate = dayOpen;
  }

  const bucketOf = (at: Date): string => {
    const { year, month, day, hour } = zonedParts(at, rules.timeZone);
    return `${year}-${month}-${day}T${hour}`;
  };

  let bucket = bucketOf(candidate);
  if (bucket !== cursor.hourBucket) {
    cursor.hourBucket = bucket;
    cursor.hourCount = 0;
  }

  if (cursor.hourCount >= rules.maxPerHourPerChannel) {
    // Hour is full: jump to the top of the next hour rather than squeezing.
    const parts = zonedParts(candidate, rules.timeZone);
    candidate = localHourOn(candidate, rules.timeZone, parts.hour + 1);
    bucket = bucketOf(candidate);
    cursor.hourBucket = bucket;
    cursor.hourCount = 0;
  }

  if (candidate.getTime() >= dayClose.getTime()) {
    return null;
  }

  cursor.nextAt = candidate;
  cursor.hourCount += 1;
  return candidate;
}

function totalRemaining(remaining: Map<string, string[]>): number {
  let total = 0;
  for (const queue of remaining.values()) {
    total += queue.length;
  }
  return total;
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}
