import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  SubscriptionRepositoryPort,
  SUBSCRIPTION_REPOSITORY,
} from '../../ports/output/subscription-repository.port';
import { ProcessPaymentWebhookCommand } from './process-payment-webhook.command';

@Injectable()
export class ProcessPaymentWebhookUseCase implements UseCase<ProcessPaymentWebhookCommand, void> {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repository: SubscriptionRepositoryPort,
  ) {}

  private readonly successStatuses = new Set([1, 2, 20]);
  private readonly failureStatuses = new Set([3, 4, 11]);

  async execute(command: ProcessPaymentWebhookCommand): Promise<void> {
    const subscription = await this.repository.findByRecurrenceId(command.recurrenceId);
    if (!subscription) {
      return;
    }

    const now = new Date();

    if (this.successStatuses.has(command.status)) {
      subscription.markPaymentConfirmed(now);
      await this.repository.save(subscription);
      return;
    }

    if (this.failureStatuses.has(command.status)) {
      subscription.markPaymentFailed(now);
      await this.repository.save(subscription);
    }
  }
}
