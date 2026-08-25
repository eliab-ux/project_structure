import { Coupon } from '@contexts/coupon/domain/entities/coupon.entity';
import { CouponId } from '@contexts/coupon/domain/value-objects/coupon-id.vo';
import { CouponCode } from '@contexts/coupon/domain/value-objects/coupon-code.vo';

export const COUPON_REPOSITORY = Symbol('COUPON_REPOSITORY');

export interface CouponRepositoryPort {
  save(coupon: Coupon): Promise<Coupon>;
  findById(id: CouponId): Promise<Coupon | null>;
  findByCode(code: CouponCode): Promise<Coupon | null>;
  findAll(filter?: { resellerId?: string | null; isActive?: boolean }): Promise<Coupon[]>;
}
