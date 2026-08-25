import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

/**
 * The bug this closes, reproduced from a real production log.
 *
 * ```
 * Webhook recebido — event=messages.upsert ... fromMe=false de=5562****8416
 * Inbound NÃO ingerido — Número não pertence à base desta conta.
 * ```
 *
 * The contact sits in the base as `+5562992238416` — thirteen digits, with the ninth. WhatsApp reported
 * the JID as `556292238416` — twelve, without it. Same person, two forms, and an exact match misses. The
 * reply was discarded as a stranger writing in, which from the operator's side is indistinguishable from
 * nobody having replied. Days went into that silence.
 *
 * Both forms are legitimately in circulation: the ninth digit was added to Brazilian mobiles
 * progressively, and the JID of an older WhatsApp account can still be the eight-digit subscriber.
 */
describe('PhoneE164.brazilianNinthDigitVariant', () => {
  it('drops the ninth digit from the exact number that failed in production', () => {
    const stored = PhoneE164.create('+5562992238416');

    expect(stored.brazilianNinthDigitVariant()?.value).toBe('+556292238416');
  });

  it('adds the ninth digit to the form WhatsApp reported', () => {
    const fromWire = PhoneE164.create('+556292238416');

    expect(fromWire.brazilianNinthDigitVariant()?.value).toBe('+5562992238416');
  });

  it('round-trips: the variant of the variant is the original', () => {
    const original = PhoneE164.create('+5561991753858');
    const variant = original.brazilianNinthDigitVariant();

    expect(variant?.brazilianNinthDigitVariant()?.value).toBe(original.value);
  });

  it('produces a candidate for a landline-shaped number too', () => {
    // Adding a 9 to what looks like a landline is a candidate for a QUERY, not a claim about the number.
    // A wrong guess matches nothing and costs one indexed lookup; refusing to guess would leave a real
    // mobile stored in the short form unreachable.
    expect(PhoneE164.create('+556232241234').brazilianNinthDigitVariant()?.value).toBe(
      '+5562932241234',
    );
  });

  it('returns null for a non-Brazilian number', () => {
    expect(PhoneE164.create('+14155552671').brazilianNinthDigitVariant()).toBeNull();
  });

  it('returns null when the subscriber length fits no Brazilian shape', () => {
    // Six subscriber digits is neither the 8 nor the 9 of a Brazilian line, so there is no variant to
    // offer. Guessing one would be inventing a number.
    expect(PhoneE164.create('+5562123456').brazilianNinthDigitVariant()).toBeNull();
  });

  it('does not treat a 9-digit subscriber that starts with 8 as having a ninth digit', () => {
    // Only a LEADING 9 is the added digit. Stripping the first digit of `8...` would invent a number.
    const nine = PhoneE164.create('+5562812345678');

    expect(nine.brazilianNinthDigitVariant()).toBeNull();
  });

  it('never mutates the original — this is lookup, not correction', () => {
    // The contact keeps the number it was imported with, so the dispatch history keeps saying exactly who
    // was messaged. Rewriting the stored number would falsify that record.
    const stored = PhoneE164.create('+5562992238416');

    stored.brazilianNinthDigitVariant();

    expect(stored.value).toBe('+5562992238416');
  });

  it('masks the two forms to different star counts, which is how the log gave the bug away', () => {
    // 13 digits → 5 stars, 12 → 4. That one character in a masked log line is what identified the cause.
    expect(PhoneE164.create('+5562992238416').masked).toBe('+5562*****8416');
    expect(PhoneE164.create('+556292238416').masked).toBe('+5562****8416');
  });
});
