import { DomainException } from '@gitspread/domain-primitives';

export class CouponAlreadyExistsException extends DomainException {
  constructor(code: string) {
    super(`Coupon already exists: ${code}`);
  }
}
