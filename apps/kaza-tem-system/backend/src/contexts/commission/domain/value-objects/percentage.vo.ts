import { ValueObject } from '@gitspread/domain-primitives';

interface PercentageProps {
  value: number;
}

export class Percentage extends ValueObject<PercentageProps> {
  private constructor(props: PercentageProps) {
    super(props);
  }

  static from(value: number): Percentage {
    if (value < 0 || value > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }
    return new Percentage({ value });
  }

  get value(): number {
    return this.props.value;
  }
}
