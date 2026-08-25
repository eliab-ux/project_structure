import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ShippingService } from '@infrastructure/shipping/shipping.service';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('calculate')
  calculate(@Query('cep') cep?: string) {
    if (!cep) {
      throw new BadRequestException('CEP é obrigatório');
    }

    const normalized = cep.replace(/\D/g, '');
    if (normalized.length !== 8) {
      throw new BadRequestException('CEP inválido');
    }

    return this.shippingService.calculate(normalized);
  }
}
