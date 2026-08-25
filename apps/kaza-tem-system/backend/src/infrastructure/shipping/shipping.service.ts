import { Injectable, Logger } from '@nestjs/common';
import { MelhorEnvioService } from '@infrastructure/integrations/melhor-envio/melhor-envio.service';

export interface ShippingOption {
  id: string;
  name: string;
  company: string;
  price: number;
  deliveryDays: number;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  private readonly defaultFromCep = '01310-100'; // Paulista Avenue, SP (warehouse example)

  constructor(private readonly melhorEnvioService: MelhorEnvioService) {}

  async calculate(
    cep: string,
    weight = 1,
    width = 20,
    height = 20,
    length = 20,
  ): Promise<ShippingOption[]> {
    try {
      const options = await this.melhorEnvioService.calculateShipping({
        fromPostalCode: this.defaultFromCep,
        toPostalCode: cep,
        weight,
        width,
        height,
        length,
      });

      return options.map((opt) => ({
        id: opt.id,
        name: opt.name,
        company: opt.company,
        price: opt.price,
        deliveryDays: opt.deliveryDays,
      }));
    } catch (error) {
      this.logger.error('Failed to calculate shipping, falling back to mock data', error);
      return this.getMockOptions(cep);
    }
  }

  async track(trackingCode: string) {
    try {
      return await this.melhorEnvioService.trackShipment(trackingCode);
    } catch (error) {
      this.logger.error(`Failed to track shipment ${trackingCode}`, error);
      throw new Error('Failed to track shipment');
    }
  }

  private getMockOptions(cep: string): ShippingOption[] {
    const baseValue = this.estimateBaseRate(cep);
    return [
      this.buildOption('sedex', 'SEDEX', baseValue + 12, 3),
      this.buildOption('pac', 'PAC', baseValue + 6, 7),
      this.buildOption('express', 'Kaza Tem Express', baseValue + 20, 1),
    ];
  }

  private estimateBaseRate(cep: string): number {
    const digits = cep.replace(/\D/g, '');
    const sum = digits.split('').reduce((acc, char) => acc + Number(char || 0), 0);
    return Number((5 + (sum % 10)).toFixed(2));
  }

  private buildOption(
    id: string,
    name: string,
    price: number,
    deliveryDays: number,
  ): ShippingOption {
    return {
      id,
      name,
      company: 'Correios',
      price: Number(price.toFixed(2)),
      deliveryDays,
    };
  }
}
