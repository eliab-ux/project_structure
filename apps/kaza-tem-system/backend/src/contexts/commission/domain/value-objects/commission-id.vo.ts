import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface CommissionIdProps {
  value: string;
}

export class CommissionId extends ValueObject<CommissionIdProps> {
  private constructor(props: CommissionIdProps) {
    super(props);
  }

  static generate(): CommissionId {
    return new CommissionId({ value: randomUUID() });
  }

  static from(value: string): CommissionId {
    return new CommissionId({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
