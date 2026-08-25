import { Injectable } from '@nestjs/common';
import { Commission } from '../../../../contexts/commission/domain/entities/commission.entity';
import { CommissionOrmEntity } from '../entities/commission-orm.entity';
import { CommissionStatus } from '../../../../contexts/commission/domain/value-objects/commission-status.vo';
import { CommissionId } from '../../../../contexts/commission/domain/value-objects/commission-id.vo';
import { Percentage } from '../../../../contexts/commission/domain/value-objects/percentage.vo';

@Injectable()
export class CommissionMapper {
  toDomain(orm: CommissionOrmEntity): Commission {
    return Commission.reconstitute({
      id: CommissionId.from(orm.id),
      resellerId: orm.resellerId,
      orderId: orm.orderId,
      orderTotal: Number(orm.orderTotal),
      commissionBase: Number(orm.commissionBase),
      percentage: Percentage.from(Number(orm.percentage)),
      amount: Number(orm.amount),
      status: CommissionStatus.from(orm.status as CommissionStatus['props']['value']),
      availableAt: orm.availableAt,
      withdrawnAt: orm.withdrawnAt ?? null,
      withdrawalId: orm.withdrawalId ?? null,
      reversedAt: orm.reversedAt ?? null,
      debtAt: orm.debtAt ?? null,
      createdAt: orm.createdAt,
    });
  }

  toOrm(domain: Commission): CommissionOrmEntity {
    const orm = new CommissionOrmEntity();
    orm.id = domain.id.value;
    orm.resellerId = domain.resellerId;
    orm.orderId = domain.orderId;
    orm.orderTotal = domain.orderTotal;
    orm.commissionBase = domain.commissionBase;
    orm.percentage = domain.percentage.value;
    orm.amount = domain.amount;
    orm.status = domain.status.value;
    orm.availableAt = domain.availableAt;
    orm.withdrawnAt = domain.withdrawnAt ?? undefined;
    orm.withdrawalId = domain.withdrawalId ?? undefined;
    orm.reversedAt = domain.reversedAt ?? undefined;
    orm.debtAt = domain.debtAt ?? undefined;
    orm.createdAt = domain.createdAt;
    return orm;
  }
}
