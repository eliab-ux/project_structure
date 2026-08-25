import { ValueObject } from '@gitspread/domain-primitives';
import { ValidationUtil } from '@gitspread/shared-kernel';
import { InvalidEmailException } from '../exceptions/invalid-email.exception';

const MAX_EMAIL_LENGTH = 255;

/** Always normalized (trimmed + lowercase) so uniqueness per account is case-insensitive. */
export class Email extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
  }

  static create(raw: string): Email {
    const value = (raw ?? '').trim().toLowerCase();
    if (!ValidationUtil.isEmail(value) || value.length > MAX_EMAIL_LENGTH) {
      throw new InvalidEmailException();
    }
    return new Email({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
