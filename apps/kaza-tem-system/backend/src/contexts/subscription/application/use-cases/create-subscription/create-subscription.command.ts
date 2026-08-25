export class CreateSubscriptionCommand {
  constructor(
    public readonly resellerId: string,
    public readonly card: {
      number: string;
      holder: string;
      expirationDate: string;
      securityCode: string;
      brand: string;
    },
    public readonly customer: {
      name: string;
      email: string;
      document: string;
    },
    public readonly amount?: number,
  ) {}
}
