import { ValueObject } from '@gitspread/domain-primitives';

export type DiscountTypeValue = 'percentage' | 'fixed';

interface DiscountTypeProps {
  value: DiscountTypeValue;
}

export class DiscountType extends ValueObject<DiscountTypeProps> {
  private constructor(props: DiscountTypeProps) {
    super(props);
  }

  static from(value: DiscountTypeValue): DiscountType {
    if (!['percentage', 'fixed'].includes(value)) {
      throw new Error('Invalid discount type');
    }
    return new DiscountType({ value });
  }

  get value(): DiscountTypeValue {
    return this.props.value;
  }
}
