export const CIELO_CLIENT = Symbol('CIELO_CLIENT');

export interface CieloPaymentRequest {
  orderId: string;
  amount: number;
  installments: number;
  card: {
    number: string;
    holder: string;
    expirationDate: string;
    securityCode: string;
    brand: 'Visa' | 'Master' | 'Elo' | 'Amex' | 'Hipercard';
  };
  customer: {
    name: string;
    email: string;
    document: string;
  };
}

export interface CieloPaymentResponse {
  paymentId?: string;
  status?: number;
  returnCode?: string;
  returnMessage?: string;
  authorizationCode?: string;
  tid?: string;
}

export interface CieloClientPort {
  createPayment(request: CieloPaymentRequest): Promise<CieloPaymentResponse>;
  capturePayment(paymentId: string, amount?: number): Promise<CieloPaymentResponse>;
  cancelPayment(paymentId: string, amount?: number): Promise<CieloPaymentResponse>;
  getPayment(paymentId: string): Promise<CieloPaymentResponse>;
}
