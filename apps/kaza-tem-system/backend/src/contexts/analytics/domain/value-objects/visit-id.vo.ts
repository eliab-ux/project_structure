import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface VisitIdProps {
  value: string;
}

export class VisitId extends ValueObject<VisitIdProps> {
  private constructor(props: VisitIdProps) {
    super(props);
  }

  static generate(): VisitId {
    return new VisitId({ value: randomUUID() });
  }

  static from(id: string): VisitId {
    if (!this.isValid(id)) {
      throw new Error('Invalid visit ID format');
    }
    return new VisitId({ value: id });
  }

  private static isValid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  get value(): string {
    return this.props.value;
  }
}
