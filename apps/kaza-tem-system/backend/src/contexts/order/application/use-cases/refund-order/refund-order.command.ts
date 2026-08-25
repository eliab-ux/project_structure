export class RefundOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly amount?: number,
    public readonly reason?: string,
  ) {}
}
