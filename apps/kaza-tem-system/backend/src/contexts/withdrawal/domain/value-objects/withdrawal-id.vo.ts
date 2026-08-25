import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface WithdrawalIdProps {
  value: string;
}

export class WithdrawalId extends ValueObject<WithdrawalIdProps> {
  private constructor(props: WithdrawalIdProps) {
    super(props);
  }

  static generate(): WithdrawalId {
    return new WithdrawalId({ value: randomUUID() });
  }

  static from(value: string): WithdrawalId {
    if (!this.isValid(value)) {
      throw new Error('Invalid withdrawal id');
    }
    return new WithdrawalId({ value });
  }

  private static isValid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  get value(): string {
    return this.props.value;
  }
}
