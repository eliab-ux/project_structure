import { Module } from '@nestjs/common';
import { ShippingController } from '@infrastructure/http/controllers/shipping/shipping.controller';
import { ShippingService } from './shipping.service';
import { MelhorEnvioModule } from '@infrastructure/integrations/melhor-envio/melhor-envio.module';

@Module({
  imports: [MelhorEnvioModule],
  providers: [ShippingService],
  controllers: [ShippingController],
  exports: [ShippingService],
})
export class ShippingModule {}
