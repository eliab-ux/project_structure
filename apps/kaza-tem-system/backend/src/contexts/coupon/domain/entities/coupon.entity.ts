import { AggregateRoot } from '@gitspread/domain-primitives';
import { CouponId } from '../value-objects/coupon-id.vo';
import { CouponCode } from '../value-objects/coupon-code.vo';
import { DiscountType, DiscountTypeValue } from '../value-objects/discount-type.vo';
import { CouponAppliedEvent } from '../events/coupon-applied.event';
import { CouponExpiredException } from '../exceptions/coupon-expired.exception';
import { CouponLimitReachedException } from '../exceptions/coupon-limit-reached.exception';

interface CreateCouponProps {
  code: string;
  discountType: DiscountTypeValue;
  discountValue: number;
  validUntil: Date;
  validFrom?: Date;
  usageLimit?: number | null;
  resellerId?: string | null;
  isActive?: boolean;
}

export class Coupon extends AggregateRoot {
  private constructor(
    private readonly _id: CouponId,
    private readonly _code: CouponCode,
    private readonly _resellerId: string | null,
    private readonly _discountType: DiscountType,
    private readonly _discountValue: number,
    private readonly _validFrom: Date,
    private readonly _validUntil: Date,
    private readonly _usageLimit: number | null,
    private _usageCount: number,
    private _isActive: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }

  static create(props: CreateCouponProps): Coupon {
    const now = new Date();
    const validFrom = props.validFrom ?? now;

    if (props.discountValue <= 0) {
      throw new Error('Discount value must be positive');
    }

    if (props.discountType === 'percentage' && props.discountValue > 100) {
      throw new Error('Percentage discount cannot exceed 100%');
    }

    if (props.validUntil <= validFrom) {
      throw new Error('validUntil must be after validFrom');
    }

    return new Coupon(
      CouponId.generate(),
      CouponCode.from(props.code),
      props.resellerId ?? null,
      DiscountType.from(props.discountType),
      props.discountValue,
      validFrom,
      props.validUntil,
      props.usageLimit ?? null,
      0,
      props.isActive ?? true,
      now,
      now,
    );
  }

  static reconstitute(
    id: CouponId,
    code: CouponCode,
    resellerId: string | null,
    discountType: DiscountType,
    discountValue: number,
    validFrom: Date,
    validUntil: Date,
    usageLimit: number | null,
    usageCount: number,
    isActive: boolean,
    createdAt: Date,
    updatedAt: Date,
  ): Coupon {
    return new Coupon(
      id,
      code,
      resellerId,
      discountType,
      discountValue,
      validFrom,
      validUntil,
      usageLimit,
      usageCount,
      isActive,
      createdAt,
      updatedAt,
    );
  }

  validate(): void {
    const now = new Date();

    if (!this._isActive) {
      throw new CouponExpiredException(this._code.value);
    }

    if (now < this._validFrom || now > this._validUntil) {
      throw new CouponExpiredException(this._code.value);
    }

    if (this._usageLimit !== null && this._usageCount >= this._usageLimit) {
      throw new CouponLimitReachedException(this._code.value);
    }
  }

  calculateDiscount(subtotal: number): number {
    if (this._discountType.value === 'percentage') {
      return Number(((subtotal * this._discountValue) / 100).toFixed(2));
    }

    return Math.min(this._discountValue, subtotal);
  }

  incrementUsage(): void {
    this._usageCount += 1;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CouponAppliedEvent(this._id.value, this._code.value, this._resellerId),
    );
  }

  // Getters
  get id(): CouponId {
    return this._id;
  }

  get code(): CouponCode {
    return this._code;
  }

  get resellerId(): string | null {
    return this._resellerId;
  }

  get discountType(): DiscountType {
    return this._discountType;
  }

  get discountValue(): number {
    return this._discountValue;
  }

  get validFrom(): Date {
    return this._validFrom;
  }

  get validUntil(): Date {
    return this._validUntil;
  }

  get usageLimit(): number | null {
    return this._usageLimit;
  }

  get usageCount(): number {
    return this._usageCount;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
