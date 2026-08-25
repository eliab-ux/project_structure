/**
 * Wall-clock arithmetic in the account's timezone, with no dependency.
 *
 * Why this exists at all: quiet hours are "08:00–21:00 **no timezone da conta**" (§9.2). A campaign
 * planned by an office in Manaus must not start sending at 06:00 local because the server thinks in
 * UTC. And the daily quota is a **calendar day**, which only means something in a timezone.
 *
 * `Intl.DateTimeFormat` is the only correct source of offsets in Node without pulling a tz library —
 * it carries the IANA database, including the historical rules a hardcoded `-03:00` would get wrong.
 */

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = FORMATTERS.get(timeZone);
  if (cached) {
    return cached;
  }
  // Throws RangeError for an unknown zone, which is the right moment to find out.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  FORMATTERS.set(timeZone, formatter);
  return formatter;
}

/** Whether a timezone name is one the runtime actually knows. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The wall-clock reading of an instant, in the given zone. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value ?? '0';
    return Number.parseInt(value, 10);
  };
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    // `hour12: false` can render midnight as 24 in some ICU versions.
    hour: read('hour') % 24,
    minute: read('minute'),
    second: read('second'),
  };
}

/** `YYYY-MM-DD` in the given zone — the key `channel_daily_counters` is grouped by. */
export function localDateKey(instant: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * The instant at which a given wall-clock time occurs in a zone.
 *
 * Two passes, and the second one is not paranoia: the offset depends on the instant, and the instant
 * is what we are solving for. Guessing with UTC, measuring the offset there, then correcting lands on
 * the right side of a DST boundary. Brazil has no DST today, but this code will outlive that fact.
 */
export function zonedTimeToUtc(parts: ZonedParts, timeZone: string): Date {
  const naive = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const firstGuess = new Date(naive - offsetMillis(new Date(naive), timeZone));
  const corrected = new Date(naive - offsetMillis(firstGuess, timeZone));
  return corrected;
}

/** How far ahead of UTC the zone is, at that instant, in milliseconds. */
export function offsetMillis(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const asIfUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  // Seconds are the finest field the formatter gives, so drop sub-second noise from both sides.
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Midnight local, as an instant. The start of the calendar day a quota belongs to. */
export function startOfLocalDay(instant: Date, timeZone: string): Date {
  const { year, month, day } = zonedParts(instant, timeZone);
  return zonedTimeToUtc({ year, month, day, hour: 0, minute: 0, second: 0 }, timeZone);
}

/** A local hour of the same local day as `instant`, as an instant. */
export function localHourOn(instant: Date, timeZone: string, hour: number): Date {
  const { year, month, day } = zonedParts(instant, timeZone);
  return zonedTimeToUtc({ year, month, day, hour, minute: 0, second: 0 }, timeZone);
}

/** The same wall-clock time, `days` calendar days later. Not `+24h`: DST would drift it. */
export function addLocalDays(instant: Date, timeZone: string, days: number): Date {
  const parts = zonedParts(instant, timeZone);
  return zonedTimeToUtc({ ...parts, day: parts.day + days }, timeZone);
}
