export class CreateCouponCommand {
  constructor(
    public readonly code: string,
    public readonly discountType: 'percentage' | 'fixed',
    public readonly discountValue: number,
    public readonly validUntil: Date,
    public readonly validFrom?: Date,
    public readonly usageLimit?: number | null,
    public readonly resellerId?: string | null,
    public readonly isActive?: boolean,
  ) {}
}
