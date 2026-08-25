import { Inject, Injectable } from '@nestjs/common';
import {
  CIELO_CLIENT,
  CieloClientPort,
  CieloPaymentRequest,
  CieloPaymentResponse,
} from './cielo-client.port';

@Injectable()
export class CieloCheckoutService {
  constructor(@Inject(CIELO_CLIENT) private readonly cieloClient: CieloClientPort) {}

  async processPayment(request: CieloPaymentRequest): Promise<CieloPaymentResponse> {
    return this.cieloClient.createPayment(request);
  }

  async capturePayment(paymentId: string, amount?: number): Promise<CieloPaymentResponse> {
    return this.cieloClient.capturePayment(paymentId, amount);
  }

  async cancelPayment(paymentId: string, amount?: number): Promise<CieloPaymentResponse> {
    return this.cieloClient.cancelPayment(paymentId, amount);
  }

  async getPayment(paymentId: string): Promise<CieloPaymentResponse> {
    return this.cieloClient.getPayment(paymentId);
  }
}
