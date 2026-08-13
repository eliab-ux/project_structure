import { ValueObject } from '@veertex/domain-primitives';
import { InvalidEmailException } from '../exceptions/invalid-email.exception';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_LENGTH = 255;

/**
 * An e-mail address, always lowercase and trimmed.
 *
 * Normalising HERE rather than at the DTO is what makes the `(account_id, email)` unique index
 * behave case-insensitively without a functional index: two users cannot register as `Ana@x.com`
 * and `ana@x.com`, and login finds the row whichever way it is typed.
 */
export class Email extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
  }

  static create(raw: string): Email {
    const value = (raw ?? '').trim().toLowerCase();
    if (!value || value.length > MAX_LENGTH || !EMAIL.test(value)) {
      throw new InvalidEmailException();
    }
    return new Email({ value });
  }

  get value(): string {
    return this.props.value;
  }

  /** For logs: an e-mail identifies a person, so only the shape is recorded. */
  get masked(): string {
    const [local, domain] = this.props.value.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }
}
