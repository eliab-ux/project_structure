import { Subscription } from '../../domain/entities/subscription.entity';

export class SubscriptionDto {
  id!: string;
  resellerId!: string;
  status!: string;
  amount!: number;
  nextBillingDate!: Date;
  startedAt!: Date;
  canceledAt?: Date | null;
  cieloRecurrenceId!: string;

  static fromDomain(subscription: Subscription): SubscriptionDto {
    const dto = new SubscriptionDto();
    dto.id = subscription.id.value;
    dto.resellerId = subscription.resellerId;
    dto.status = subscription.status.value;
    dto.amount = subscription.amount;
    dto.nextBillingDate = subscription.nextBillingDate;
    dto.startedAt = subscription.startedAt;
    dto.canceledAt = subscription.canceledAt;
    dto.cieloRecurrenceId = subscription.cieloRecurrenceId;
    return dto;
  }
}
