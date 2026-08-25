import { randomUUID } from 'crypto';
import { ValueObject } from '@gitspread/domain-primitives';
import { ValidationUtil } from '@gitspread/shared-kernel';
import { InvalidAccountIdException } from '../exceptions/invalid-account-id.exception';

export class AccountId extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
    if (!ValidationUtil.isUUID(props.value)) {
      throw new InvalidAccountIdException();
    }
  }

  static generate(): AccountId {
    return new AccountId({ value: randomUUID() });
  }

  static from(value: string): AccountId {
    return new AccountId({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
