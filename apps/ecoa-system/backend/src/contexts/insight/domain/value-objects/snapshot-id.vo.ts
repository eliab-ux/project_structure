import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface SnapshotIdProps {
  value: string;
}

export class SnapshotId extends ValueObject<SnapshotIdProps> {
  private constructor(props: SnapshotIdProps) {
    super(props);
  }

  static generate(): SnapshotId {
    return new SnapshotId({ value: randomUUID() });
  }

  static from(id: string): SnapshotId {
    if (!this.isValid(id)) {
      throw new Error('Invalid Snapshot ID format');
    }
    return new SnapshotId({ value: id });
  }

  private static isValid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  get value(): string {
    return this.props.value;
  }
}
