import { AggregateRoot } from '@gitspread/domain-primitives';
import { SubscriptionId } from '../value-objects/subscription-id.vo';
import { SubscriptionStatus } from '../value-objects/subscription-status.vo';
import { SubscriptionCreatedEvent } from '../events/subscription-created.event';
import { SubscriptionPaymentConfirmedEvent } from '../events/subscription-payment-confirmed.event';
import { SubscriptionPaymentFailedEvent } from '../events/subscription-payment-failed.event';
import { SubscriptionCanceledEvent } from '../events/subscription-canceled.event';
import { InvalidSubscriptionStatusException } from '../exceptions/invalid-subscription-status.exception';

interface SubscriptionProps {
  id: SubscriptionId;
  resellerId: string;
  cieloRecurrenceId: string;
  status: SubscriptionStatus;
  amount: number;
  nextBillingDate: Date;
  startedAt: Date;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Subscription extends AggregateRoot {
  private constructor(private readonly props: SubscriptionProps) {
    super();
  }

  static create(payload: {
    resellerId: string;
    cieloRecurrenceId: string;
    amount: number;
    startedAt?: Date;
    nextBillingDate?: Date;
  }): Subscription {
    const now = new Date();
    const startedAt = payload.startedAt ?? now;
    const nextBillingDate =
      payload.nextBillingDate ??
      (() => {
        const next = new Date(startedAt);
        next.setMonth(next.getMonth() + 1);
        return next;
      })();

    const subscription = new Subscription({
      id: SubscriptionId.generate(),
      resellerId: payload.resellerId,
      cieloRecurrenceId: payload.cieloRecurrenceId,
      status: SubscriptionStatus.ACTIVE,
      amount: payload.amount,
      nextBillingDate,
      startedAt,
      canceledAt: null,
      createdAt: now,
      updatedAt: now,
    });

    subscription.addDomainEvent(
      new SubscriptionCreatedEvent(subscription.id.value, payload.resellerId, payload.amount),
    );
    return subscription;
  }

  static reconstitute(props: SubscriptionProps): Subscription {
    return new Subscription({ ...props });
  }

  get id(): SubscriptionId {
    return this.props.id;
  }

  get resellerId(): string {
    return this.props.resellerId;
  }

  get cieloRecurrenceId(): string {
    return this.props.cieloRecurrenceId;
  }

  get status(): SubscriptionStatus {
    return this.props.status;
  }

  get amount(): number {
    return this.props.amount;
  }

  get nextBillingDate(): Date {
    return this.props.nextBillingDate;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get canceledAt(): Date | null {
    return this.props.canceledAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  markPaymentConfirmed(billingDate: Date): void {
    if (this.props.status.value === 'canceled') {
      throw new InvalidSubscriptionStatusException(
        'Cannot confirm payment on canceled subscription',
      );
    }

    const nextBilling = new Date(billingDate);
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    this.props.status = SubscriptionStatus.ACTIVE;
    this.props.nextBillingDate = nextBilling;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new SubscriptionPaymentConfirmedEvent(this.id.value, this.resellerId, billingDate),
    );
  }

  markPaymentFailed(attemptedAt: Date): void {
    if (!this.props.status.canSuspend()) {
      throw new InvalidSubscriptionStatusException('Subscription cannot be suspended right now');
    }

    this.props.status = SubscriptionStatus.SUSPENDED;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new SubscriptionPaymentFailedEvent(this.id.value, this.resellerId, attemptedAt),
    );
  }

  suspend(): void {
    if (!this.props.status.canSuspend()) {
      throw new InvalidSubscriptionStatusException('Subscription cannot be suspended');
    }
    this.props.status = SubscriptionStatus.SUSPENDED;
    this.props.updatedAt = new Date();
  }

  cancel(): void {
    if (!this.props.status.canCancel()) {
      throw new InvalidSubscriptionStatusException('Subscription already canceled');
    }
    this.props.status = SubscriptionStatus.CANCELED;
    this.props.canceledAt = new Date();
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new SubscriptionCanceledEvent(this.id.value, this.resellerId, this.props.canceledAt),
    );
  }

  reactivate(): void {
    if (this.props.status.value !== 'suspended') {
      throw new InvalidSubscriptionStatusException(
        'Only suspended subscriptions can be reactivated',
      );
    }
    this.props.status = SubscriptionStatus.ACTIVE;
    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    this.props.nextBillingDate = nextBilling;
    this.props.updatedAt = new Date();
    this.props.canceledAt = null;
  }

  updateNextBillingDate(date: Date): void {
    this.props.nextBillingDate = date;
    this.props.updatedAt = new Date();
  }
}
