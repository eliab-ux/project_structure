import { ValueObject } from '@veertex/domain-primitives';
import { InvalidPhoneNumberException } from '../exceptions/invalid-phone-number.exception';

/** Brazil: 55 + 2-digit area code + 8 or 9 subscriber digits. */
const BRAZIL_COUNTRY_CODE = '55';
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * A phone number in E.164, stored WITH the leading `+`.
 *
 * Lives in `shared/` and not inside a context because it is not owned by one: a user's WhatsApp
 * (where the recovery code goes), a contact's phone and a sales rep's phone are all this same
 * thing, and two implementations of the normalisation would eventually disagree — a contact
 * imported as `62999998888` would not match a number stored as `+5562999998888`. One class,
 * one truth.
 */
export class PhoneE164 extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
  }

  /**
   * Accepts what a Brazilian operator actually types — `(62) 99999-9999`, `62999999999`,
   * `5562999999999`, `+55 62 99999-9999` — and yields one canonical form.
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
   * Masked form for logs and audit payloads. A full phone number is personal data and CLAUDE.md
   * forbids logging it — this is what goes in a log line.
   */
  get masked(): string {
    const v = this.props.value;
    return `${v.slice(0, 5)}${'*'.repeat(Math.max(0, v.length - 9))}${v.slice(-4)}`;
  }
}
