import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';
import { InvalidUserIdException } from '../exceptions/invalid-user-id.exception';

interface UserIdProps {
  value: string;
}

export class UserId extends ValueObject<UserIdProps> {
  private constructor(props: UserIdProps) {
    super(props);
  }

  static generate(): UserId {
    return new UserId({ value: randomUUID() });
  }

  static from(id: string): UserId {
    if (!this.isValid(id)) {
      throw new InvalidUserIdException();
    }
    return new UserId({ value: id });
  }

  private static isValid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  get value(): string {
    return this.props.value;
  }
}
