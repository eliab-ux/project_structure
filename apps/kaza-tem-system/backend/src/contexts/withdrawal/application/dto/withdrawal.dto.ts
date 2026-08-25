import { Withdrawal } from '../../domain/entities/withdrawal.entity';

export class WithdrawalDto {
  id!: string;
  resellerId!: string;
  amount!: number;
  status!: string;
  commissionIds!: string[];
  bankName!: string;
  bankAgency!: string;
  bankAccount!: string;
  bankAccountType?: string | null;
  pixKey?: string | null;
  approvedAt!: Date | null;
  approvedBy!: string | null;
  paidAt!: Date | null;
  rejectedAt!: Date | null;
  rejectedReason!: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  static fromDomain(withdrawal: Withdrawal): WithdrawalDto {
    const dto = new WithdrawalDto();
    dto.id = withdrawal.id.value;
    dto.resellerId = withdrawal.resellerId.value;
    dto.amount = withdrawal.amount;
    dto.status = withdrawal.status.value;
    dto.commissionIds = withdrawal.commissionIds.map((id) => id.value);
    dto.bankName = withdrawal.bankData.bankName;
    dto.bankAgency = withdrawal.bankData.bankAgency;
    dto.bankAccount = withdrawal.bankData.bankAccount;
    dto.bankAccountType = withdrawal.bankData.bankAccountType ?? null;
    dto.pixKey = withdrawal.bankData.pixKey ?? null;
    dto.approvedAt = withdrawal.approvedAt;
    dto.approvedBy = withdrawal.approvedBy;
    dto.paidAt = withdrawal.paidAt;
    dto.rejectedAt = withdrawal.rejectedAt;
    dto.rejectedReason = withdrawal.rejectedReason;
    dto.createdAt = withdrawal.createdAt;
    dto.updatedAt = withdrawal.updatedAt;
    return dto;
  }
}
