export class CommissionRule {
  constructor(
    public readonly id: string,
    public readonly minAmount: number,
    public readonly maxAmount: number | null,
    public readonly percentage: number,
    public readonly isActive: boolean,
  ) {}

  matches(monthlySales: number): boolean {
    if (!this.isActive) return false;
    if (monthlySales < this.minAmount) return false;
    if (this.maxAmount !== null && monthlySales > this.maxAmount) return false;
    return true;
  }
}
