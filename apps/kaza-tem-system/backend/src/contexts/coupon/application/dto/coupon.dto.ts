import { Coupon } from '@contexts/coupon/domain/entities/coupon.entity';

export class CouponDto {
  id!: string;
  code!: string;
  resellerId!: string | null;
  discountType!: string;
  discountValue!: number;
  validFrom!: Date;
  validUntil!: Date;
  usageLimit!: number | null;
  usageCount!: number;
  isActive!: boolean;
  createdAt!: Date;
  updatedAt!: Date;

  static fromDomain(coupon: Coupon): CouponDto {
    const dto = new CouponDto();
    dto.id = coupon.id.value;
    dto.code = coupon.code.value;
    dto.resellerId = coupon.resellerId;
    dto.discountType = coupon.discountType.value;
    dto.discountValue = coupon.discountValue;
    dto.validFrom = coupon.validFrom;
    dto.validUntil = coupon.validUntil;
    dto.usageLimit = coupon.usageLimit;
    dto.usageCount = coupon.usageCount;
    dto.isActive = coupon.isActive;
    dto.createdAt = coupon.createdAt;
    dto.updatedAt = coupon.updatedAt;
    return dto;
  }
}
