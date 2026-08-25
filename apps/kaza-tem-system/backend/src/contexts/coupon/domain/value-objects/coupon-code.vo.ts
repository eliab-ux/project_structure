import { ValueObject } from '@gitspread/domain-primitives';

interface CouponCodeProps {
  value: string;
}

export class CouponCode extends ValueObject<CouponCodeProps> {
  private constructor(props: CouponCodeProps) {
    super(props);
  }

  static from(code: string): CouponCode {
    const normalized = code.trim().toUpperCase();

    if (normalized.length === 0) {
      throw new Error('Coupon code cannot be empty');
    }

    if (normalized.length > 50) {
      throw new Error('Coupon code must be 50 characters or less');
    }

    if (/\s/.test(normalized)) {
      throw new Error('Coupon code cannot contain spaces');
    }

    return new CouponCode({ value: normalized });
  }

  get value(): string {
    return this.props.value;
  }
}
