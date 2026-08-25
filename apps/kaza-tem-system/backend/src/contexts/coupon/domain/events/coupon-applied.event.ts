import { DomainEvent } from '@gitspread/domain-primitives';

export class CouponAppliedEvent extends DomainEvent {
  constructor(
    public readonly couponId: string,
    public readonly code: string,
    public readonly resellerId: string | null,
  ) {
    super();
  }

  get eventName(): string {
    return 'coupon.applied';
  }
}
