import { DomainException } from '@gitspread/domain-primitives';

export class CouponExpiredException extends DomainException {
  constructor(code: string) {
    super(`Coupon expired or inactive: ${code}`);
  }
}
