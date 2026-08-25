export class ProcessPaymentCommand {
  constructor(
    public readonly orderId: string,
    public readonly installments: number,
    public readonly card: {
      number: string;
      holder: string;
      expirationDate: string;
      securityCode: string;
      brand: 'Visa' | 'Master' | 'Elo' | 'Amex' | 'Hipercard';
    },
    public readonly customer: {
      name: string;
      email: string;
      document: string;
    },
    public readonly amount?: number,
  ) {}
}
