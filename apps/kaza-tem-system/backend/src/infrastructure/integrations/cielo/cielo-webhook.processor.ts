import { Injectable } from '@nestjs/common';
import { CieloWebhookDto } from './dto/cielo-webhook.dto';
import { ProcessPaymentWebhookUseCase as OrderWebhookUseCase } from '@contexts/order/application/use-cases/process-payment-webhook/process-payment-webhook.use-case';
import { ProcessPaymentWebhookCommand as OrderWebhookCommand } from '@contexts/order/application/use-cases/process-payment-webhook/process-payment-webhook.command';
import { ProcessPaymentWebhookUseCase as SubscriptionWebhookUseCase } from '@contexts/subscription/application/use-cases/process-payment-webhook/process-payment-webhook.use-case';
import { ProcessPaymentWebhookCommand as SubscriptionWebhookCommand } from '@contexts/subscription/application/use-cases/process-payment-webhook/process-payment-webhook.command';

@Injectable()
export class CieloWebhookProcessor {
  constructor(
    private readonly orderWebhook: OrderWebhookUseCase,
    private readonly subscriptionWebhook: SubscriptionWebhookUseCase,
  ) {}

  async process(payload: CieloWebhookDto): Promise<void> {
    if (payload.PaymentId && payload.ChangeType) {
      await this.orderWebhook.execute(new OrderWebhookCommand(payload.PaymentId));
    }

    if (payload.RecurrentPaymentId && payload.Status !== undefined) {
      await this.subscriptionWebhook.execute(
        new SubscriptionWebhookCommand(
          payload.RecurrentPaymentId,
          payload.Status,
          payload.PaymentId ?? '',
          payload.Amount ?? 0,
        ),
      );
    }
  }
}
