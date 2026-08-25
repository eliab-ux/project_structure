import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface ConnectionIdProps {
  value: string;
}

export class ConnectionId extends ValueObject<ConnectionIdProps> {
  private constructor(props: ConnectionIdProps) {
    super(props);
  }

  static generate(): ConnectionId {
    return new ConnectionId({ value: randomUUID() });
  }

  static from(id: string): ConnectionId {
    if (!this.isValid(id)) {
      throw new Error('Invalid Connection ID format');
    }
    return new ConnectionId({ value: id });
  }

  private static isValid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  get value(): string {
    return this.props.value;
  }
}
