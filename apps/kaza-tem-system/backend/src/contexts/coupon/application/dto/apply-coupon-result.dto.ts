import { Coupon } from '@contexts/coupon/domain/entities/coupon.entity';
import { CouponDto } from './coupon.dto';

export class ApplyCouponResultDto {
  coupon!: CouponDto;
  discountAmount!: number;

  static fromDomain(coupon: Coupon, discountAmount: number): ApplyCouponResultDto {
    const dto = new ApplyCouponResultDto();
    dto.coupon = CouponDto.fromDomain(coupon);
    dto.discountAmount = discountAmount;
    return dto;
  }
}
