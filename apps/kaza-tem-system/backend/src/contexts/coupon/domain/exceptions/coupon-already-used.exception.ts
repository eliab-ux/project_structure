import { DomainException } from '@gitspread/domain-primitives';

export class CouponAlreadyUsedException extends DomainException {
  constructor(code: string) {
    super(`Coupon already used: ${code}`);
  }
}
