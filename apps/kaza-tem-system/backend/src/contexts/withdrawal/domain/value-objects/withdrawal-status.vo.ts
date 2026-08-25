import { ValueObject } from '@gitspread/domain-primitives';

export type WithdrawalStatusValue = 'requested' | 'approved' | 'paid' | 'rejected';

export class WithdrawalStatus extends ValueObject<{ value: WithdrawalStatusValue }> {
  static readonly REQUESTED = new WithdrawalStatus({ value: 'requested' });
  static readonly APPROVED = new WithdrawalStatus({ value: 'approved' });
  static readonly PAID = new WithdrawalStatus({ value: 'paid' });
  static readonly REJECTED = new WithdrawalStatus({ value: 'rejected' });

  private constructor(props: { value: WithdrawalStatusValue }) {
    super(props);
  }

  get value(): WithdrawalStatusValue {
    return this.props.value;
  }

  static from(value: WithdrawalStatusValue): WithdrawalStatus {
    switch (value) {
      case 'requested':
        return WithdrawalStatus.REQUESTED;
      case 'approved':
        return WithdrawalStatus.APPROVED;
      case 'paid':
        return WithdrawalStatus.PAID;
      case 'rejected':
        return WithdrawalStatus.REJECTED;
      default:
        throw new Error(`Unknown withdrawal status: ${value}`);
    }
  }
}
