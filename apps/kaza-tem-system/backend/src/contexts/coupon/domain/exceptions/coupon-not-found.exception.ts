import { DomainException } from '@gitspread/domain-primitives';

export class CouponNotFoundException extends DomainException {
  constructor(code: string) {
    super(`Coupon not found: ${code}`);
  }
}
