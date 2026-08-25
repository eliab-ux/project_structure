import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface OwnMediaIdProps {
  value: string;
}

export class OwnMediaId extends ValueObject<OwnMediaIdProps> {
  private constructor(props: OwnMediaIdProps) {
    super(props);
  }

  static generate(): OwnMediaId {
    return new OwnMediaId({ value: randomUUID() });
  }

  static from(id: string): OwnMediaId {
    if (!this.isValid(id)) {
      throw new Error('Invalid OwnMedia ID format');
    }
    return new OwnMediaId({ value: id });
  }

  private static isValid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  get value(): string {
    return this.props.value;
  }
}
