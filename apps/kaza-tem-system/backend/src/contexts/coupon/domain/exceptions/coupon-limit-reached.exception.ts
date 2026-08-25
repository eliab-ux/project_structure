import { DomainException } from '@gitspread/domain-primitives';

export class CouponLimitReachedException extends DomainException {
  constructor(code: string) {
    super(`Coupon usage limit reached: ${code}`);
  }
}
