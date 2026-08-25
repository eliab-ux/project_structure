import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface DetectionIdProps {
  value: string;
}

export class DetectionId extends ValueObject<DetectionIdProps> {
  private constructor(props: DetectionIdProps) {
    super(props);
  }

  static generate(): DetectionId {
    return new DetectionId({ value: randomUUID() });
  }

  static from(id: string): DetectionId {
    if (!this.isValid(id)) {
      throw new Error('Invalid Detection ID format');
    }
    return new DetectionId({ value: id });
  }

  private static isValid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  get value(): string {
    return this.props.value;
  }
}
