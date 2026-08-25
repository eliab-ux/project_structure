import { ValueObject } from '@gitspread/domain-primitives';

export type SubscriptionStatusValue = 'active' | 'suspended' | 'canceled';

export class SubscriptionStatus extends ValueObject<{ value: SubscriptionStatusValue }> {
  static readonly ACTIVE = new SubscriptionStatus({ value: 'active' });
  static readonly SUSPENDED = new SubscriptionStatus({ value: 'suspended' });
  static readonly CANCELED = new SubscriptionStatus({ value: 'canceled' });

  private constructor(props: { value: SubscriptionStatusValue }) {
    super(props);
  }

  get value(): SubscriptionStatusValue {
    return this.props.value;
  }

  static from(value: string): SubscriptionStatus {
    switch (value) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'suspended':
        return SubscriptionStatus.SUSPENDED;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      default:
        throw new Error(`Invalid subscription status: ${value}`);
    }
  }

  canSuspend(): boolean {
    return this.value === 'active';
  }

  canCancel(): boolean {
    return this.value !== 'canceled';
  }
}
