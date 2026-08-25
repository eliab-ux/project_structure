import { ValueObject } from '@gitspread/domain-primitives';

type ResellerStatusType = 'pending' | 'active' | 'rejected' | 'suspended';

interface ResellerStatusProps {
  status: ResellerStatusType;
}

export class ResellerStatus extends ValueObject<ResellerStatusProps> {
  private constructor(props: ResellerStatusProps) {
    super(props);
  }

  static pending(): ResellerStatus {
    return new ResellerStatus({ status: 'pending' });
  }

  static active(): ResellerStatus {
    return new ResellerStatus({ status: 'active' });
  }

  static rejected(): ResellerStatus {
    return new ResellerStatus({ status: 'rejected' });
  }

  static suspended(): ResellerStatus {
    return new ResellerStatus({ status: 'suspended' });
  }

  static from(status: string): ResellerStatus {
    switch (status) {
      case 'pending':
        return ResellerStatus.pending();
      case 'active':
        return ResellerStatus.active();
      case 'rejected':
        return ResellerStatus.rejected();
      case 'suspended':
        return ResellerStatus.suspended();
      default:
        throw new Error(`Invalid reseller status: ${status}`);
    }
  }

  get value(): ResellerStatusType {
    return this.props.status;
  }

  isPending(): boolean {
    return this.props.status === 'pending';
  }

  isActive(): boolean {
    return this.props.status === 'active';
  }

  isSuspended(): boolean {
    return this.props.status === 'suspended';
  }
}
