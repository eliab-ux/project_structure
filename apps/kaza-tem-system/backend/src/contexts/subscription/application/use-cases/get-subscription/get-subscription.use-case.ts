import { Injectable, Inject } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { GetSubscriptionQuery } from './get-subscription.query';
import {
  SubscriptionRepositoryPort,
  SUBSCRIPTION_REPOSITORY,
} from '../../ports/output/subscription-repository.port';
import { SubscriptionDto } from '../../dto/subscription.dto';

@Injectable()
export class GetSubscriptionUseCase implements UseCase<
  GetSubscriptionQuery,
  SubscriptionDto | null
> {
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly repository: SubscriptionRepositoryPort,
  ) {}

  async execute(command: GetSubscriptionQuery): Promise<SubscriptionDto | null> {
    const subscription = await this.repository.findByResellerId(command.resellerId);
    if (!subscription) {
      return null;
    }
    return SubscriptionDto.fromDomain(subscription);
  }
}
