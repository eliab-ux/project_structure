import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { CancelSubscriptionCommand } from './cancel-subscription.command';
import {
  SubscriptionRepositoryPort,
  SUBSCRIPTION_REPOSITORY,
} from '../../ports/output/subscription-repository.port';
import { CieloRecurrenceService } from '@infrastructure/integrations/cielo/cielo-recurrence.service';
import { SubscriptionNotFoundException } from '../../../domain/exceptions/subscription-not-found.exception';

@Injectable()
export class CancelSubscriptionUseCase implements UseCase<CancelSubscriptionCommand, void> {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repository: SubscriptionRepositoryPort,
    private readonly recurrenceService: CieloRecurrenceService,
  ) {}

  async execute(command: CancelSubscriptionCommand): Promise<void> {
    const subscription = await this.repository.findById(command.subscriptionId);
    if (!subscription) {
      throw new SubscriptionNotFoundException(command.subscriptionId);
    }

    await this.recurrenceService.deactivateRecurringPayment(subscription.cieloRecurrenceId);
    subscription.cancel();
    await this.repository.save(subscription);
  }
}
