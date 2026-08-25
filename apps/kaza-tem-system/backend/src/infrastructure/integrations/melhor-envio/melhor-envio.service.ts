import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  MELHOR_ENVIO_CLIENT,
  MelhorEnvioClientPort,
  MelhorEnvioShippingQuote,
  MelhorEnvioTracking,
} from './melhor-envio-client.port';

export interface CalculateShippingRequest {
  fromPostalCode: string;
  toPostalCode: string;
  weight: number;
  width: number;
  height: number;
  length: number;
}

export interface ShippingOption {
  id: string;
  name: string;
  company: string;
  price: number;
  deliveryDays: number;
  deliveryRange: {
    min: number;
    max: number;
  };
}

@Injectable()
export class MelhorEnvioService {
  private readonly logger = new Logger(MelhorEnvioService.name);

  constructor(
    @Inject(MELHOR_ENVIO_CLIENT)
    private readonly client: MelhorEnvioClientPort,
  ) {}

  async calculateShipping(request: CalculateShippingRequest): Promise<ShippingOption[]> {
    try {
      const quotes = await this.client.calculateShipping(
        { postal_code: request.fromPostalCode },
        { postal_code: request.toPostalCode },
        [
          {
            weight: request.weight,
            width: request.width,
            height: request.height,
            length: request.length,
          },
        ],
      );

      return quotes.map((quote) => this.mapQuoteToOption(quote));
    } catch (error) {
      this.logger.error('Failed to calculate shipping', error);
      throw new Error('Failed to calculate shipping');
    }
  }

  async trackShipment(trackingCode: string): Promise<MelhorEnvioTracking> {
    try {
      return await this.client.trackShipment(trackingCode);
    } catch (error) {
      this.logger.error(`Failed to track shipment ${trackingCode}`, error);
      throw new Error('Failed to track shipment');
    }
  }

  private mapQuoteToOption(quote: MelhorEnvioShippingQuote): ShippingOption {
    return {
      id: quote.id.toString(),
      name: quote.name,
      company: quote.company.name,
      price: parseFloat(quote.price),
      deliveryDays: quote.delivery_time,
      deliveryRange: {
        min: quote.delivery_range.min,
        max: quote.delivery_range.max,
      },
    };
  }
}
