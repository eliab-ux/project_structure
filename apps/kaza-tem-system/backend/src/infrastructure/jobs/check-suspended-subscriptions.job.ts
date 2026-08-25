import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  SubscriptionRepositoryPort,
  SUBSCRIPTION_REPOSITORY,
} from '@contexts/subscription/application/ports/output/subscription-repository.port';

@Injectable()
export class CheckSuspendedSubscriptionsJob {
  private readonly logger = new Logger(CheckSuspendedSubscriptionsJob.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repository: SubscriptionRepositoryPort,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async execute(): Promise<void> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 7);
    const suspended = await this.repository.findSuspendedBefore(threshold);
    if (suspended.length === 0) {
      return;
    }

    for (const subscription of suspended) {
      subscription.cancel();
      await this.repository.save(subscription);
      this.logger.log(`Assinatura ${subscription.id.value} cancelada após 7 dias em suspensão`);
    }
  }
}
