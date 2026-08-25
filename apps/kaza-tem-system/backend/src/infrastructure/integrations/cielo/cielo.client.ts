import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CieloClientPort, CieloPaymentRequest, CieloPaymentResponse } from './cielo-client.port';

@Injectable()
export class CieloClient implements CieloClientPort {
  private readonly apiUrl: string;
  private readonly queryUrl: string;
  private readonly merchantId: string;
  private readonly merchantKey: string;

  constructor(private readonly configService: ConfigService) {
    const environment = this.configService.get<string>('CIELO_ENVIRONMENT') || 'sandbox';

    if (environment === 'production') {
      this.apiUrl = 'https://api.cieloecommerce.cielo.com.br';
      this.queryUrl = 'https://apiquery.cieloecommerce.cielo.com.br';
    } else {
      this.apiUrl = 'https://apisandbox.cieloecommerce.cielo.com.br';
      this.queryUrl = 'https://apiquerysandbox.cieloecommerce.cielo.com.br';
    }

    this.merchantId = this.configService.getOrThrow<string>('CIELO_MERCHANT_ID');
    this.merchantKey = this.configService.getOrThrow<string>('CIELO_MERCHANT_KEY');
  }

  async createPayment(request: CieloPaymentRequest): Promise<CieloPaymentResponse> {
    const body = {
      MerchantOrderId: request.orderId,
      Customer: {
        Name: request.customer.name,
        Email: request.customer.email,
        Identity: request.customer.document,
        IdentityType: 'CPF',
      },
      Payment: {
        Type: 'CreditCard',
        Amount: request.amount,
        Installments: request.installments,
        Capture: true,
        CreditCard: {
          CardNumber: request.card.number,
          Holder: request.card.holder,
          ExpirationDate: request.card.expirationDate,
          SecurityCode: request.card.securityCode,
          Brand: request.card.brand,
        },
      },
    };

    const response = await fetch(`${this.apiUrl}/1/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        MerchantId: this.merchantId,
        MerchantKey: this.merchantKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return this.mapResponse(data);
  }

  async capturePayment(paymentId: string, amount?: number): Promise<CieloPaymentResponse> {
    const url = amount
      ? `${this.apiUrl}/1/sales/${paymentId}/capture?amount=${amount}`
      : `${this.apiUrl}/1/sales/${paymentId}/capture`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        MerchantId: this.merchantId,
        MerchantKey: this.merchantKey,
      },
    });

    const data = await response.json();
    return this.mapResponse(data);
  }

  async cancelPayment(paymentId: string, amount?: number): Promise<CieloPaymentResponse> {
    const url = amount
      ? `${this.apiUrl}/1/sales/${paymentId}/void?amount=${amount}`
      : `${this.apiUrl}/1/sales/${paymentId}/void`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        MerchantId: this.merchantId,
        MerchantKey: this.merchantKey,
      },
    });

    const data = await response.json();
    return this.mapResponse(data);
  }

  async getPayment(paymentId: string): Promise<CieloPaymentResponse> {
    const response = await fetch(`${this.queryUrl}/1/sales/${paymentId}`, {
      method: 'GET',
      headers: {
        MerchantId: this.merchantId,
        MerchantKey: this.merchantKey,
      },
    });

    const data = await response.json();
    return this.mapResponse(data);
  }

  private mapResponse(data: any): CieloPaymentResponse {
    return {
      paymentId: data.Payment?.PaymentId,
      status: data.Payment?.Status,
      returnCode: data.Payment?.ReturnCode,
      returnMessage: data.Payment?.ReturnMessage,
      authorizationCode: data.Payment?.AuthorizationCode,
      tid: data.Payment?.Tid,
    };
  }
}
