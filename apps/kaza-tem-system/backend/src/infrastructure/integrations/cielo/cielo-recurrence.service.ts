import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CieloRecurrenceService {
  private readonly merchantId: string;
  private readonly merchantKey: string;
  private readonly recurrenceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.merchantId = this.configService.getOrThrow<string>('CIELO_MERCHANT_ID');
    this.merchantKey = this.configService.getOrThrow<string>('CIELO_MERCHANT_KEY');
    this.recurrenceUrl =
      this.configService.get<string>('CIELO_RECURRENCE_URL') ??
      'https://api.cieloecommerce.cielo.com.br/1/RecurrentPayment';
  }

  async createRecurringPayment(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request(this.recurrenceUrl, 'POST', payload);
  }

  async deactivateRecurringPayment(id: string): Promise<Record<string, unknown>> {
    const endpoint = `${this.recurrenceUrl}/${encodeURIComponent(id)}/Deactivate`;
    return this.request(endpoint, 'PUT');
  }

  private async request(
    url: string,
    method: 'POST' | 'PUT',
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(url, {
      method,
      headers: this.createHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.handleResponse(response);
  }

  private createHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      MerchantId: this.merchantId,
      MerchantKey: this.merchantKey,
    };
  }

  private async handleResponse(response: Response): Promise<Record<string, unknown>> {
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      const message =
        (payload?.['ErrorMessage'] as string) ??
        (payload?.['Message'] as string) ??
        'Erro ao comunicar com a Cielo';
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }

    return payload;
  }
}
