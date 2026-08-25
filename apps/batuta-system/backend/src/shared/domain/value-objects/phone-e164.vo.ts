import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidPhoneNumberException } from '../exceptions/invalid-phone-number.exception';

/** Brazil: 55 + 2-digit area code + 8 or 9 subscriber digits. */
const BRAZIL_COUNTRY_CODE = '55';
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * A phone number in E.164, stored WITH the leading `+`.
 *
 * SHARED on purpose, not owned by a context: a chip number (channel) and a contact number are
 * compared for equality by the "one contact, one sender" rule (§1.2, §6.3). Two implementations of
 * this normalisation would eventually disagree — a contact imported as `11999998888` would not match
 * a chip stored as `+5511999998888` — and the routing would silently break. One class, one truth. Normalisation lives here so that a chip
 * number and an imported contact number can never disagree about format — the whole
 * "one contact, one sender" rule depends on the two matching exactly.
 */
export class PhoneE164 extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
  }

  /**
   * Accepts what a Brazilian operator actually types — `(11) 99999-9999`, `11999999999`,
   * `5511999999999`, `+55 11 99999-9999` — and yields one canonical form.
   *
   * A number with no country code is assumed Brazilian, because that is the market; anything
   * already carrying a `+` is respected as given.
   */
  static create(raw: string): PhoneE164 {
    const input = (raw ?? '').trim();
    if (!input) {
      throw new InvalidPhoneNumberException();
    }

    const hadPlus = input.startsWith('+');
    const digits = input.replace(/\D/g, '');
    if (!digits) {
      throw new InvalidPhoneNumberException();
    }

    let normalized: string;
    if (hadPlus) {
      normalized = `+${digits}`;
    } else if (digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length >= 12) {
      normalized = `+${digits}`;
    } else if (digits.length === 10 || digits.length === 11) {
      // Local Brazilian number (area code + subscriber), no country code.
      normalized = `+${BRAZIL_COUNTRY_CODE}${digits}`;
    } else {
      throw new InvalidPhoneNumberException();
    }

    if (!E164.test(normalized)) {
      throw new InvalidPhoneNumberException();
    }

    return new PhoneE164({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }

  /** Digits only, which is what the Evolution API expects in a JID. */
  get digits(): string {
    return this.props.value.slice(1);
  }

  /**
   * Masked form for logs and DTOs. A full phone number is personal data and CLAUDE.md forbids
   * logging it — this is what goes in a log line or an audit payload.
   */
  get masked(): string {
    const v = this.props.value;
    return `${v.slice(0, 5)}${'*'.repeat(Math.max(0, v.length - 9))}${v.slice(-4)}`;
  }

  /**
   * The same Brazilian mobile written the other way — with the ninth digit if this one lacks it, or
   * without it if this one has it. `null` for anything the rule does not apply to.
   *
   * **Why this exists, and it cost a long investigation.** A contact imported as `+5562992238416`
   * (13 digits, with the 9) is the same person WhatsApp reports as `556292238416` (12 digits, without
   * it). Both forms are in circulation: the ninth digit was added to Brazilian mobiles progressively,
   * and WhatsApp's JID for an older account can still be the eight-digit one. An exact match therefore
   * misses, and every reply from that person was discarded as "número não pertence à base" — silently,
   * because from the system's side it looked exactly like a stranger writing in.
   *
   * This is for LOOKUP ONLY. Nothing stored is rewritten: the contact keeps the number it was imported
   * with, the dispatch history keeps pointing at the same row, and "one contact, one sender" is
   * untouched. Reconciling at read time is what makes it safe — rewriting the number would falsify the
   * record of who was messaged.
   *
   * The 12-digit variant is generated even when the subscriber part looks like a landline. It is a
   * candidate for a query, not a claim about the number: a wrong guess matches nothing and costs one
   * indexed lookup.
   */
  brazilianNinthDigitVariant(): PhoneE164 | null {
    const digits = this.digits;
    if (!digits.startsWith(BRAZIL_COUNTRY_CODE)) {
      return null;
    }

    const areaCode = digits.slice(2, 4);
    const subscriber = digits.slice(4);

    // 13 digits with a leading 9 on the subscriber → drop it.
    if (subscriber.length === 9 && subscriber.startsWith('9')) {
      return PhoneE164.create(`+${BRAZIL_COUNTRY_CODE}${areaCode}${subscriber.slice(1)}`);
    }
    // 12 digits → add it.
    if (subscriber.length === 8) {
      return PhoneE164.create(`+${BRAZIL_COUNTRY_CODE}${areaCode}9${subscriber}`);
    }
    return null;
  }
}
