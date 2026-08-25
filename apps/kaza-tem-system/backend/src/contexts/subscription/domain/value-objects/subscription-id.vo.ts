import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface SubscriptionIdProps {
  value: string;
}

export class SubscriptionId extends ValueObject<SubscriptionIdProps> {
  private constructor(props: SubscriptionIdProps) {
    super(props);
  }

  static generate(): SubscriptionId {
    return new SubscriptionId({ value: randomUUID() });
  }

  static from(value: string): SubscriptionId {
    if (!this.isValid(value)) {
      throw new Error('Invalid Subscription ID');
    }
    return new SubscriptionId({ value });
  }

  get value(): string {
    return this.props.value;
  }

  private static isValid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
