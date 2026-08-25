export class UpdateOrderStatusCommand {
  constructor(
    public readonly orderId: string,
    public readonly status: string,
    public readonly trackingCode?: string,
    public readonly paymentId?: string,
    public readonly paymentMethod?: string,
  ) {}
}
