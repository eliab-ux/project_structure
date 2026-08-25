import { randomUUID } from 'crypto';
import { ValueObject } from '@gitspread/domain-primitives';
import { ValidationUtil } from '@gitspread/shared-kernel';
import { InvalidUserIdException } from '../exceptions/invalid-user-id.exception';

export class UserId extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props);
    if (!ValidationUtil.isUUID(props.value)) {
      throw new InvalidUserIdException();
    }
  }

  static generate(): UserId {
    return new UserId({ value: randomUUID() });
  }

  static from(value: string): UserId {
    return new UserId({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
