import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface WatchedAccountIdProps {
  value: string;
}

export class WatchedAccountId extends ValueObject<WatchedAccountIdProps> {
  private constructor(props: WatchedAccountIdProps) {
    super(props);
  }

  static generate(): WatchedAccountId {
    return new WatchedAccountId({ value: randomUUID() });
  }

  static from(id: string): WatchedAccountId {
    if (!this.isValid(id)) {
      throw new Error('Invalid WatchedAccount ID format');
    }
    return new WatchedAccountId({ value: id });
  }

  private static isValid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  get value(): string {
    return this.props.value;
  }
}
