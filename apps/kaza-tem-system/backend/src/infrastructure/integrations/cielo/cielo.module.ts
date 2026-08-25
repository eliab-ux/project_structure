import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CieloClient } from './cielo.client';
import { CieloCheckoutService } from './cielo-checkout.service';
import { CieloRecurrenceService } from './cielo-recurrence.service';
import { CieloWebhookProcessor } from './cielo-webhook.processor';
import { CieloWebhookValidationService } from './services/cielo-webhook.service';
import { CIELO_CLIENT } from './cielo-client.port';
import { OrderModule } from '@contexts/order/order.module';
import { SubscriptionModule } from '@contexts/subscription/subscription.module';

@Module({
  imports: [ConfigModule, forwardRef(() => OrderModule), forwardRef(() => SubscriptionModule)],
  providers: [
    CieloClient,
    CieloCheckoutService,
    CieloRecurrenceService,
    CieloWebhookProcessor,
    CieloWebhookValidationService,
    {
      provide: CIELO_CLIENT,
      useClass: CieloClient,
    },
  ],
  exports: [
    CIELO_CLIENT,
    CieloCheckoutService,
    CieloRecurrenceService,
    CieloWebhookProcessor,
    CieloWebhookValidationService,
  ],
})
export class CieloModule {}
