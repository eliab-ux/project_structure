import { Injectable } from '@nestjs/common';
import { Withdrawal } from '@contexts/withdrawal/domain/entities/withdrawal.entity';
import { WithdrawalOrmEntity } from '../entities/withdrawal-orm.entity';
import { WithdrawalId } from '@contexts/withdrawal/domain/value-objects/withdrawal-id.vo';
import { WithdrawalStatus } from '@contexts/withdrawal/domain/value-objects/withdrawal-status.vo';
import { ResellerId } from '@contexts/reseller/domain/value-objects/reseller-id.vo';
import { CommissionId } from '@contexts/commission/domain/value-objects/commission-id.vo';
import { BankData } from '@contexts/withdrawal/domain/value-objects/bank-data.vo';

@Injectable()
export class WithdrawalMapper {
  toDomain(orm: WithdrawalOrmEntity): Withdrawal {
    const props = {
      id: WithdrawalId.from(orm.id),
      resellerId: ResellerId.from(orm.resellerId),
      amount: Number(orm.amount),
      commissionIds: (orm.commissionIds ?? []).map((id) => CommissionId.from(id)),
      bankData: BankData.create({
        bankName: orm.bankName,
        bankAgency: orm.bankAgency,
        bankAccount: orm.bankAccount,
        bankAccountType: orm.bankAccountType ?? undefined,
        pixKey: orm.pixKey ?? undefined,
      }),
      status: WithdrawalStatus.from(orm.status as WithdrawalStatus['props']['value']),
      approvedAt: orm.approvedAt ?? null,
      approvedBy: orm.approvedBy ?? null,
      paidAt: orm.paidAt ?? null,
      rejectedAt: orm.rejectedAt ?? null,
      rejectedReason: orm.rejectedReason ?? null,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };

    return Withdrawal.reconstitute(props);
  }

  toOrm(domain: Withdrawal): WithdrawalOrmEntity {
    const orm = new WithdrawalOrmEntity();
    orm.id = domain.id.value;
    orm.resellerId = domain.resellerId.value;
    orm.amount = domain.amount;
    orm.status = domain.status.value;
    orm.commissionIds = domain.commissionIds.map((id) => id.value);
    orm.bankName = domain.bankData.bankName;
    orm.bankAgency = domain.bankData.bankAgency;
    orm.bankAccount = domain.bankData.bankAccount;
    orm.bankAccountType = domain.bankData.bankAccountType ?? undefined;
    orm.pixKey = domain.bankData.pixKey ?? undefined;
    orm.approvedAt = domain.approvedAt ?? undefined;
    orm.approvedBy = domain.approvedBy ?? undefined;
    orm.paidAt = domain.paidAt ?? undefined;
    orm.rejectedAt = domain.rejectedAt ?? undefined;
    orm.rejectedReason = domain.rejectedReason ?? undefined;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
