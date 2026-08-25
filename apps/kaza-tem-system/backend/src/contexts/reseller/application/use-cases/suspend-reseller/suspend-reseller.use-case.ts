import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { SuspendResellerCommand } from './suspend-reseller.command';
import {
  RESELLER_REPOSITORY,
  ResellerRepositoryPort,
} from '../../ports/output/reseller-repository.port';
import { UNIT_OF_WORK, UnitOfWorkPort } from '@infrastructure/persistence/ports/unit-of-work.port';
import { ResellerId } from '../../../domain/value-objects/reseller-id.vo';
import { ResellerNotFoundException } from '../../../domain/exceptions/reseller-not-found.exception';
import {
  SubscriptionRepositoryPort,
  SUBSCRIPTION_REPOSITORY,
} from '@contexts/subscription/application/ports/output/subscription-repository.port';
import { CieloRecurrenceService } from '@infrastructure/integrations/cielo/cielo-recurrence.service';

@Injectable()
export class SuspendResellerUseCase implements UseCase<SuspendResellerCommand, void> {
  constructor(
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepository: SubscriptionRepositoryPort,
    private readonly recurrenceService: CieloRecurrenceService,
  ) {}

  async execute(command: SuspendResellerCommand): Promise<void> {
    const resellerId = ResellerId.from(command.resellerId);
    const reseller = await this.resellerRepository.findById(resellerId);

    if (!reseller) {
      throw new ResellerNotFoundException(command.resellerId);
    }

    reseller.suspend(command.adminId, command.reason);

    await this.unitOfWork.execute(async () => {
      await this.resellerRepository.save(reseller);

      const subscription = await this.subscriptionRepository.findByResellerId(reseller.id.value);
      if (subscription && subscription.status.canSuspend()) {
        await this.recurrenceService.deactivateRecurringPayment(subscription.cieloRecurrenceId);
        subscription.suspend();
        await this.subscriptionRepository.save(subscription);
      }
    });
  }
}
