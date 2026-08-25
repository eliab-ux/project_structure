import { ValueObject } from '@gitspread/domain-primitives';

export type CommissionStatusValue = 'pending' | 'available' | 'withdrawn' | 'reversed' | 'debt';

export class CommissionStatus extends ValueObject<{ value: CommissionStatusValue }> {
  static readonly PENDING = new CommissionStatus({ value: 'pending' });
  static readonly AVAILABLE = new CommissionStatus({ value: 'available' });
  static readonly WITHDRAWN = new CommissionStatus({ value: 'withdrawn' });
  static readonly REVERSED = new CommissionStatus({ value: 'reversed' });
  static readonly DEBT = new CommissionStatus({ value: 'debt' });

  protected constructor(props: { value: CommissionStatusValue }) {
    super(props);
  }

  get value(): CommissionStatusValue {
    return this.props.value;
  }

  static from(value: CommissionStatusValue): CommissionStatus {
    switch (value) {
      case 'pending':
        return CommissionStatus.PENDING;
      case 'available':
        return CommissionStatus.AVAILABLE;
      case 'withdrawn':
        return CommissionStatus.WITHDRAWN;
      case 'reversed':
        return CommissionStatus.REVERSED;
      case 'debt':
        return CommissionStatus.DEBT;
      default:
        throw new Error(`Invalid commission status: ${value}`);
    }
  }
}
