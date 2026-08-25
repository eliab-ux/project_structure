import { AggregateRoot } from '@gitspread/domain-primitives';
import { WithdrawalId } from '../value-objects/withdrawal-id.vo';
import { ResellerId } from '@contexts/reseller/domain/value-objects/reseller-id.vo';
import { CommissionId } from '@contexts/commission/domain/value-objects/commission-id.vo';
import { BankData } from '../value-objects/bank-data.vo';
import { WithdrawalStatus } from '../value-objects/withdrawal-status.vo';
import { InvalidWithdrawalAmountException } from '../exceptions/invalid-withdrawal-amount.exception';
import { InvalidWithdrawalStatusException } from '../exceptions/invalid-withdrawal-status.exception';
import { WithdrawalRequestedEvent } from '../events/withdrawal-requested.event';
import { WithdrawalApprovedEvent } from '../events/withdrawal-approved.event';
import { WithdrawalPaidEvent } from '../events/withdrawal-paid.event';
import { WithdrawalRejectedEvent } from '../events/withdrawal-rejected.event';

interface WithdrawalProps {
  id: WithdrawalId;
  resellerId: ResellerId;
  amount: number;
  commissionIds: CommissionId[];
  bankData: BankData;
  status: WithdrawalStatus;
  approvedAt: Date | null;
  approvedBy: string | null;
  paidAt: Date | null;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Withdrawal extends AggregateRoot {
  private constructor(private readonly props: WithdrawalProps) {
    super();
  }

  static create(
    resellerId: ResellerId,
    amount: number,
    commissionIds: CommissionId[],
    bankData: BankData,
  ): Withdrawal {
    if (amount < 50) {
      throw new InvalidWithdrawalAmountException('Minimum withdrawal amount is R$ 50.00');
    }

    const now = new Date();
    const withdrawal = new Withdrawal({
      id: WithdrawalId.generate(),
      resellerId,
      amount,
      commissionIds,
      bankData,
      status: WithdrawalStatus.REQUESTED,
      approvedAt: null,
      approvedBy: null,
      paidAt: null,
      rejectedAt: null,
      rejectedReason: null,
      createdAt: now,
      updatedAt: now,
    });

    withdrawal.addDomainEvent(
      new WithdrawalRequestedEvent(withdrawal.id.value, resellerId.value, amount),
    );

    return withdrawal;
  }

  static reconstitute(props: WithdrawalProps): Withdrawal {
    return new Withdrawal(props);
  }

  approve(adminId: string): void {
    if (this.props.status.value !== 'requested') {
      throw new InvalidWithdrawalStatusException('Only requested withdrawals can be approved');
    }
    this.props.status = WithdrawalStatus.APPROVED;
    this.props.approvedAt = new Date();
    this.props.approvedBy = adminId;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WithdrawalApprovedEvent(
        this.props.id.value,
        this.props.resellerId.value,
        this.props.amount,
      ),
    );
  }

  markAsPaid(): void {
    if (this.props.status.value !== 'approved') {
      throw new InvalidWithdrawalStatusException('Only approved withdrawals can be marked as paid');
    }
    this.props.status = WithdrawalStatus.PAID;
    this.props.paidAt = new Date();
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WithdrawalPaidEvent(this.props.id.value, this.props.resellerId.value, this.props.amount),
    );
  }

  reject(reason: string): void {
    if (this.props.status.value !== 'requested') {
      throw new InvalidWithdrawalStatusException('Only requested withdrawals can be rejected');
    }
    this.props.status = WithdrawalStatus.REJECTED;
    this.props.rejectedAt = new Date();
    this.props.rejectedReason = reason;
    this.props.updatedAt = new Date();

    this.addDomainEvent(
      new WithdrawalRejectedEvent(this.props.id.value, this.props.resellerId.value, reason),
    );
  }

  get id(): WithdrawalId {
    return this.props.id;
  }

  get resellerId(): ResellerId {
    return this.props.resellerId;
  }

  get amount(): number {
    return this.props.amount;
  }

  get commissionIds(): CommissionId[] {
    return [...this.props.commissionIds];
  }

  get bankData(): BankData {
    return this.props.bankData;
  }

  get status(): WithdrawalStatus {
    return this.props.status;
  }

  get approvedAt(): Date | null {
    return this.props.approvedAt;
  }

  get approvedBy(): string | null {
    return this.props.approvedBy;
  }

  get paidAt(): Date | null {
    return this.props.paidAt;
  }

  get rejectedAt(): Date | null {
    return this.props.rejectedAt;
  }

  get rejectedReason(): string | null {
    return this.props.rejectedReason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toPlainObject() {
    return { ...this.props };
  }
}
