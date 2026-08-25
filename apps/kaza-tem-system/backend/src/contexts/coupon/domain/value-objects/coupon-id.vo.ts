import { ValueObject } from '@gitspread/domain-primitives';
import { randomUUID } from 'crypto';

interface CouponIdProps {
  value: string;
}

export class CouponId extends ValueObject<CouponIdProps> {
  private constructor(props: CouponIdProps) {
    super(props);
  }

  static generate(): CouponId {
    return new CouponId({ value: randomUUID() });
  }

  static from(id: string): CouponId {
    if (!this.isValid(id)) {
      throw new Error('Invalid Coupon ID format');
    }
    return new CouponId({ value: id });
  }

  private static isValid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  get value(): string {
    return this.props.value;
  }
}
