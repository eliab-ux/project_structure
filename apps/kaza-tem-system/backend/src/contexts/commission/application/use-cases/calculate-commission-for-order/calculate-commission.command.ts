export class CalculateCommissionCommand {
  constructor(
    public readonly resellerId: string,
    public readonly orderId: string,
    public readonly orderTotal: number,
    public readonly shippingCost: number,
    public readonly discount?: number,
  ) {}
}
