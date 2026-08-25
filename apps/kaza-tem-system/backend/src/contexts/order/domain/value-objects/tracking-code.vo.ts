import { ValueObject } from '@gitspread/domain-primitives';

interface TrackingCodeProps {
  value: string;
}

export class TrackingCode extends ValueObject<TrackingCodeProps> {
  private constructor(props: TrackingCodeProps) {
    super(props);
  }

  static from(value: string): TrackingCode {
    if (!value.trim()) {
      throw new Error('Tracking code cannot be empty');
    }
    return new TrackingCode({ value: value.trim() });
  }

  get value(): string {
    return this.props.value;
  }
}
