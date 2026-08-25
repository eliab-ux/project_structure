import {
  addLocalDays,
  isValidTimeZone,
  localDateKey,
  localHourOn,
  offsetMillis,
  startOfLocalDay,
  zonedParts,
  zonedTimeToUtc,
} from '../../../src/shared/domain/services/zoned-time';

const SP = 'America/Sao_Paulo';
const MANAUS = 'America/Manaus';
const LISBON = 'Europe/Lisbon';

describe('zonedParts', () => {
  it('reads the wall clock of the zone, not of the server', () => {
    // 12:00Z is 09:00 in São Paulo (UTC−3) and 08:00 in Manaus (UTC−4).
    expect(zonedParts(new Date('2026-08-04T12:00:00Z'), SP).hour).toBe(9);
    expect(zonedParts(new Date('2026-08-04T12:00:00Z'), MANAUS).hour).toBe(8);
  });

  it('crosses the date line correctly', () => {
    // 01:00Z on the 5th is still 22:00 on the 4th in São Paulo.
    const parts = zonedParts(new Date('2026-08-05T01:00:00Z'), SP);
    expect(parts.day).toBe(4);
    expect(parts.hour).toBe(22);
  });

  it('renders midnight as 0, never as 24', () => {
    expect(zonedParts(new Date('2026-08-05T03:00:00Z'), SP).hour).toBe(0);
  });
});

describe('localDateKey', () => {
  it('is the calendar day of the ZONE — which is what a daily quota means', () => {
    // The same instant belongs to two different days depending on the account.
    const instant = new Date('2026-08-05T02:00:00Z');
    expect(localDateKey(instant, SP)).toBe('2026-08-04');
    expect(localDateKey(instant, LISBON)).toBe('2026-08-05');
  });

  it('pads month and day, so keys sort lexicographically', () => {
    expect(localDateKey(new Date('2026-01-02T15:00:00Z'), SP)).toBe('2026-01-02');
  });
});

describe('zonedTimeToUtc', () => {
  it('resolves a wall-clock time to the right instant', () => {
    const instant = zonedTimeToUtc(
      { year: 2026, month: 8, day: 4, hour: 8, minute: 0, second: 0 },
      SP,
    );

    // 08:00 in São Paulo is 11:00Z.
    expect(instant.toISOString()).toBe('2026-08-04T11:00:00.000Z');
  });

  it('round-trips: parts → instant → parts', () => {
    const parts = { year: 2026, month: 12, day: 31, hour: 21, minute: 30, second: 0 };
    const instant = zonedTimeToUtc(parts, SP);

    expect(zonedParts(instant, SP)).toEqual(parts);
  });

  it('is correct across a DST boundary in a zone that still has one', () => {
    // Lisbon springs forward on 2026-03-29 at 01:00 UTC. 02:00 local on the 29th does not exist;
    // whatever it resolves to must still be a real instant, and 03:00 local must be exact.
    const after = zonedTimeToUtc(
      { year: 2026, month: 3, day: 29, hour: 3, minute: 0, second: 0 },
      LISBON,
    );
    expect(zonedParts(after, LISBON).hour).toBe(3);

    const before = zonedTimeToUtc(
      { year: 2026, month: 3, day: 28, hour: 3, minute: 0, second: 0 },
      LISBON,
    );
    // One is UTC+0, the other UTC+1 — a fixed offset would get one of them wrong.
    expect(offsetMillis(before, LISBON)).not.toBe(offsetMillis(after, LISBON));
  });
});

describe('startOfLocalDay and localHourOn', () => {
  it('midnight local is not midnight UTC', () => {
    const start = startOfLocalDay(new Date('2026-08-04T15:00:00Z'), SP);

    expect(start.toISOString()).toBe('2026-08-04T03:00:00.000Z');
    expect(zonedParts(start, SP).hour).toBe(0);
  });

  it('resolves a quiet-hours boundary on the local day of the instant', () => {
    const eightAm = localHourOn(new Date('2026-08-04T15:00:00Z'), SP, 8);

    expect(zonedParts(eightAm, SP)).toMatchObject({ day: 4, hour: 8, minute: 0 });
  });

  it('hour 24 rolls into the next local day, which the scheduler relies on', () => {
    // nextSlot() asks for hour + 1 and must land on tomorrow when it was 23:00.
    const next = localHourOn(new Date('2026-08-05T02:00:00Z'), SP, 24);

    expect(zonedParts(next, SP)).toMatchObject({ day: 5, hour: 0 });
  });
});

describe('addLocalDays', () => {
  it('keeps the same wall-clock time on the next calendar day', () => {
    const start = new Date('2026-08-04T12:00:00Z'); // 09:00 local
    const next = addLocalDays(start, SP, 1);

    expect(zonedParts(next, SP)).toMatchObject({ day: 5, hour: 9 });
  });

  it('is not "plus 24 hours" across a DST change', () => {
    // Lisbon, day before the spring-forward: same wall clock, 23 real hours later.
    const start = zonedTimeToUtc(
      { year: 2026, month: 3, day: 28, hour: 10, minute: 0, second: 0 },
      LISBON,
    );
    const next = addLocalDays(start, LISBON, 1);

    expect(zonedParts(next, LISBON).hour).toBe(10);
    expect(next.getTime() - start.getTime()).toBe(23 * 3_600_000);
  });

  it('rolls over month ends', () => {
    const next = addLocalDays(new Date('2026-08-31T15:00:00Z'), SP, 1);
    expect(zonedParts(next, SP)).toMatchObject({ month: 9, day: 1 });
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects invented ones', () => {
    expect(isValidTimeZone(SP)).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('America/Sao_Paolo')).toBe(false);
    expect(isValidTimeZone('BRT')).toBe(false);
  });
});
