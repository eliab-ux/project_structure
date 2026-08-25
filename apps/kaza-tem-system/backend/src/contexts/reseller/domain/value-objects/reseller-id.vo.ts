import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface ResellerIdProps {
  value: string;
}

export class ResellerId extends ValueObject<ResellerIdProps> {
  private constructor(props: ResellerIdProps) {
    super(props);
  }

  static generate(): ResellerId {
    return new ResellerId({ value: randomUUID() });
  }

  static from(id: string): ResellerId {
    if (!this.isValid(id)) {
      throw new Error('Invalid Reseller ID format');
    }
    return new ResellerId({ value: id });
  }

  private static isValid(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  }

  get value(): string {
    return this.props.value;
  }
}
