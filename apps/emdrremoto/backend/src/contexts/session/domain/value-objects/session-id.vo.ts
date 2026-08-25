import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface SessionIdProps {
  value: string;
}

export class SessionId extends ValueObject<SessionIdProps> {
  private constructor(props: SessionIdProps) {
    super(props);
  }

  static generate(): SessionId {
    return new SessionId({ value: randomUUID() });
  }

  static from(id: string): SessionId {
    if (!id || typeof id !== 'string') {
      throw new Error('Invalid Session ID');
    }
    return new SessionId({ value: id });
  }

  get value(): string {
    return this.props.value;
  }
}
