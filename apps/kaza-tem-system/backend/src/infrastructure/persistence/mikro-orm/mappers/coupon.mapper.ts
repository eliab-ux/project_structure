import { Injectable } from '@nestjs/common';
import { Coupon } from '@contexts/coupon/domain/entities/coupon.entity';
import { CouponId } from '@contexts/coupon/domain/value-objects/coupon-id.vo';
import { CouponCode } from '@contexts/coupon/domain/value-objects/coupon-code.vo';
import {
  DiscountType,
  DiscountTypeValue,
} from '@contexts/coupon/domain/value-objects/discount-type.vo';
import { CouponOrmEntity } from '../entities/coupon-orm.entity';

@Injectable()
export class CouponMapper {
  toDomain(orm: CouponOrmEntity): Coupon {
    return Coupon.reconstitute(
      CouponId.from(orm.id),
      CouponCode.from(orm.code),
      orm.resellerId ?? null,
      DiscountType.from(orm.discountType as DiscountTypeValue),
      Number(orm.discountValue),
      orm.validFrom,
      orm.validUntil,
      orm.usageLimit ?? null,
      orm.usageCount,
      orm.isActive,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  toOrm(domain: Coupon): CouponOrmEntity {
    const orm = new CouponOrmEntity();
    orm.id = domain.id.value;
    orm.code = domain.code.value;
    orm.resellerId = domain.resellerId ?? null;
    orm.discountType = domain.discountType.value;
    orm.discountValue = domain.discountValue;
    orm.validFrom = domain.validFrom;
    orm.validUntil = domain.validUntil;
    orm.usageLimit = domain.usageLimit ?? null;
    orm.usageCount = domain.usageCount;
    orm.isActive = domain.isActive;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }

  toOrmPartial(domain: Coupon, existing: CouponOrmEntity): CouponOrmEntity {
    existing.code = domain.code.value;
    existing.resellerId = domain.resellerId ?? null;
    existing.discountType = domain.discountType.value;
    existing.discountValue = domain.discountValue;
    existing.validFrom = domain.validFrom;
    existing.validUntil = domain.validUntil;
    existing.usageLimit = domain.usageLimit ?? null;
    existing.usageCount = domain.usageCount;
    existing.isActive = domain.isActive;
    existing.updatedAt = domain.updatedAt;
    return existing;
  }
}
