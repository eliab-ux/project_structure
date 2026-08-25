import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  MelhorEnvioClientPort,
  MelhorEnvioAddress,
  MelhorEnvioPackage,
  MelhorEnvioShippingQuote,
  MelhorEnvioTracking,
} from './melhor-envio-client.port';

@Injectable()
export class MelhorEnvioClient implements MelhorEnvioClientPort {
  private readonly logger = new Logger(MelhorEnvioClient.name);
  private readonly apiUrl: string;
  private readonly token: string;
  private readonly httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('MELHOR_ENVIO_API_URL') || 'https://melhorenvio.com.br/api/v2';
    this.token = this.configService.get<string>('MELHOR_ENVIO_TOKEN') || '';

    this.httpClient = axios.create({
      baseURL: this.apiUrl,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
    });
  }

  async calculateShipping(
    from: MelhorEnvioAddress,
    to: MelhorEnvioAddress,
    packages: MelhorEnvioPackage[],
  ): Promise<MelhorEnvioShippingQuote[]> {
    if (!this.token) {
      this.logger.warn('Melhor Envio token not configured, returning mock data');
      return this.getMockQuotes(to.postal_code);
    }

    try {
      const response = await this.httpClient.post<MelhorEnvioShippingQuote[]>(
        '/shipment/calculate',
        {
          from: {
            postal_code: from.postal_code,
          },
          to: {
            postal_code: to.postal_code,
          },
          packages: packages.map((pkg) => ({
            weight: pkg.weight,
            width: pkg.width,
            height: pkg.height,
            length: pkg.length,
          })),
        },
      );

      this.logger.log(`Calculated shipping from ${from.postal_code} to ${to.postal_code}`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to calculate shipping', error);
      return this.getMockQuotes(to.postal_code);
    }
  }

  async trackShipment(trackingCode: string): Promise<MelhorEnvioTracking> {
    if (!this.token) {
      this.logger.warn('Melhor Envio token not configured, returning mock tracking');
      return this.getMockTracking(trackingCode);
    }

    try {
      const response = await this.httpClient.get<MelhorEnvioTracking>(
        `/shipment/tracking/${trackingCode}`,
      );

      this.logger.log(`Tracked shipment: ${trackingCode}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to track shipment ${trackingCode}`, error);
      return this.getMockTracking(trackingCode);
    }
  }

  private getMockQuotes(cep: string): MelhorEnvioShippingQuote[] {
    const basePrice = this.estimateBaseRate(cep);

    return [
      {
        id: 1,
        name: 'PAC',
        company: {
          id: 1,
          name: 'Correios',
          picture: 'https://melhorenvio.com.br/images/correios.png',
        },
        price: (basePrice + 10).toFixed(2),
        custom_price: (basePrice + 10).toFixed(2),
        discount: '0.00',
        currency: 'R$',
        delivery_time: 7,
        delivery_range: {
          min: 5,
          max: 9,
        },
      },
      {
        id: 2,
        name: 'SEDEX',
        company: {
          id: 1,
          name: 'Correios',
          picture: 'https://melhorenvio.com.br/images/correios.png',
        },
        price: (basePrice + 20).toFixed(2),
        custom_price: (basePrice + 20).toFixed(2),
        discount: '0.00',
        currency: 'R$',
        delivery_time: 3,
        delivery_range: {
          min: 2,
          max: 4,
        },
      },
    ];
  }

  private getMockTracking(trackingCode: string): MelhorEnvioTracking {
    return {
      id: trackingCode,
      protocol: trackingCode,
      status: 'delivered',
      tracking: trackingCode,
      events: [
        {
          status: 'posted',
          description: 'Objeto postado',
          datetime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Unidade de Postagem - São Paulo/SP',
        },
        {
          status: 'in_transit',
          description: 'Objeto em trânsito',
          datetime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Centro de Distribuição - São Paulo/SP',
        },
        {
          status: 'out_for_delivery',
          description: 'Objeto saiu para entrega',
          datetime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          location: 'Unidade de Distribuição - São Paulo/SP',
        },
        {
          status: 'delivered',
          description: 'Objeto entregue ao destinatário',
          datetime: new Date().toISOString(),
          location: 'São Paulo/SP',
        },
      ],
    };
  }

  private estimateBaseRate(cep: string): number {
    const digits = cep.replace(/\D/g, '');
    const sum = digits.split('').reduce((acc, char) => acc + Number(char || 0), 0);
    return Number((10 + (sum % 15)).toFixed(2));
  }
}
