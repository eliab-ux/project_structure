export class CreateCouponRequestDto {
  code!: string;
  discountType!: 'percentage' | 'fixed';
  discountValue!: number;
  validFrom?: string;
  validUntil!: string;
  usageLimit?: number;
  isActive?: boolean;
  resellerId?: string;
}
