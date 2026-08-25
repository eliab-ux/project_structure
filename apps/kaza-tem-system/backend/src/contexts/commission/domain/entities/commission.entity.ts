import { AggregateRoot } from '@gitspread/domain-primitives';
import { CommissionId } from '../value-objects/commission-id.vo';
import { CommissionStatus } from '../value-objects/commission-status.vo';
import { Percentage } from '../value-objects/percentage.vo';
import { CommissionCalculatedEvent } from '../events/commission-calculated.event';

interface CommissionProps {
  id: CommissionId;
  resellerId: string;
  orderId: string;
  orderTotal: number;
  commissionBase: number;
  percentage: Percentage;
  amount: number;
  status: CommissionStatus;
  availableAt: Date;
  withdrawnAt: Date | null;
  withdrawalId: string | null;
  reversedAt: Date | null;
  debtAt: Date | null;
  createdAt: Date;
}

export class Commission extends AggregateRoot {
  private constructor(private readonly props: CommissionProps) {
    super();
  }

  static calculate(data: {
    resellerId: string;
    orderId: string;
    orderTotal: number;
    shippingCost: number;
    discount?: number;
    percentage: Percentage;
  }): Commission {
    const id = CommissionId.generate();
    const discount = data.discount ?? 0;
    const commissionBase = Math.max(data.orderTotal - data.shippingCost - discount, 0);
    const amount = Number((commissionBase * (data.percentage.value / 100)).toFixed(2));
    const availableAt = new Date();
    availableAt.setDate(availableAt.getDate() + 30);

    const commission = new Commission({
      id,
      resellerId: data.resellerId,
      orderId: data.orderId,
      orderTotal: data.orderTotal,
      commissionBase,
      percentage: data.percentage,
      amount,
      status: CommissionStatus.PENDING,
      availableAt,
      withdrawnAt: null,
      withdrawalId: null,
      reversedAt: null,
      debtAt: null,
      createdAt: new Date(),
    });

    commission.addDomainEvent(new CommissionCalculatedEvent(id.value, data.resellerId, amount));

    return commission;
  }

  static reconstitute(props: CommissionProps): Commission {
    return new Commission(props);
  }

  get id(): CommissionId {
    return this.props.id;
  }

  get resellerId(): string {
    return this.props.resellerId;
  }

  get status(): CommissionStatus {
    return this.props.status;
  }

  get amount(): number {
    return this.props.amount;
  }

  get availableAt(): Date {
    return this.props.availableAt;
  }

  get orderId(): string {
    return this.props.orderId;
  }

  get orderTotal(): number {
    return this.props.orderTotal;
  }

  get commissionBase(): number {
    return this.props.commissionBase;
  }

  get percentage(): Percentage {
    return this.props.percentage;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get withdrawnAt(): Date | null {
    return this.props.withdrawnAt;
  }

  get withdrawalId(): string | null {
    return this.props.withdrawalId;
  }

  get reversedAt(): Date | null {
    return this.props.reversedAt;
  }

  get debtAt(): Date | null {
    return this.props.debtAt;
  }

  release(): void {
    if (this.props.status.value !== 'pending') {
      throw new Error('Only pending commissions can be released');
    }
    this.props.status = CommissionStatus.AVAILABLE;
  }

  markAsWithdrawn(withdrawalId: string): void {
    if (this.props.status.value !== 'available') {
      throw new Error('Only available commissions can be withdrawn');
    }
    this.props.status = CommissionStatus.WITHDRAWN;
    this.props.withdrawnAt = new Date();
    this.props.withdrawalId = withdrawalId;
  }

  markAsReversed(): void {
    if (this.props.status.value !== 'available') {
      throw new Error('Only available commissions can be reversed');
    }
    this.props.status = CommissionStatus.REVERSED;
    this.props.reversedAt = new Date();
  }

  markAsDebt(): void {
    if (this.props.status.value !== 'withdrawn') {
      throw new Error('Only withdrawn commissions can become debt');
    }
    this.props.status = CommissionStatus.DEBT;
    this.props.debtAt = new Date();
  }

  isReadyToRelease(): boolean {
    return this.props.status.value === 'pending' && new Date() >= this.props.availableAt;
  }
}
