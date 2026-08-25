export class ProcessPaymentWebhookCommand {
  constructor(
    public readonly recurrenceId: string,
    public readonly status: number,
    public readonly paymentId: string,
    public readonly amount: number,
  ) {}
}
