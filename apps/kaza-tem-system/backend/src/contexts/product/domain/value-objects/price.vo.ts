import { ValueObject } from '@gitspread/domain-primitives';
import { InvalidPriceException } from '../exceptions/invalid-price.exception';

interface PriceProps {
  amount: number;
}

export class Price extends ValueObject<PriceProps> {
  private constructor(props: PriceProps) {
    super(props);
  }

  static create(amount: number): Price {
    if (amount < 0) {
      throw new InvalidPriceException('Price cannot be negative');
    }

    const roundedAmount = Math.round(amount * 100) / 100;

    return new Price({ amount: roundedAmount });
  }

  get value(): number {
    return this.props.amount;
  }

  add(other: Price): Price {
    return Price.create(this.value + other.value);
  }

  subtract(other: Price): Price {
    return Price.create(this.value - other.value);
  }

  multiply(factor: number): Price {
    return Price.create(this.value * factor);
  }
}
