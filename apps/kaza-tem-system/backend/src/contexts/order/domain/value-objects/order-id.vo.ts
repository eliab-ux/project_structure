import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface OrderIdProps {
  value: string;
}

export class OrderId extends ValueObject<OrderIdProps> {
  private constructor(props: OrderIdProps) {
    super(props);
  }

  static generate(): OrderId {
    return new OrderId({ value: randomUUID() });
  }

  static from(value: string): OrderId {
    if (!this.isValid(value)) {
      throw new Error('Invalid Order ID format');
    }
    return new OrderId({ value });
  }

  private static isValid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  get value(): string {
    return this.props.value;
  }
}
