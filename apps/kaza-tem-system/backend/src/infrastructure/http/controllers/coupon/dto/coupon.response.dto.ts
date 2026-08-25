import { CouponDto } from '@contexts/coupon/application/dto/coupon.dto';

export class CouponResponseDto {
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

  static fromDto(dto: CouponDto): CouponResponseDto {
    const response = new CouponResponseDto();
    response.id = dto.id;
    response.code = dto.code;
    response.resellerId = dto.resellerId;
    response.discountType = dto.discountType;
    response.discountValue = dto.discountValue;
    response.validFrom = dto.validFrom;
    response.validUntil = dto.validUntil;
    response.usageLimit = dto.usageLimit;
    response.usageCount = dto.usageCount;
    response.isActive = dto.isActive;
    response.createdAt = dto.createdAt;
    response.updatedAt = dto.updatedAt;
    return response;
  }
}
