import { Injectable } from '@nestjs/common';
import { Machine } from '../../../../contexts/machine/domain/entities/machine.entity';
import { MachineId } from '../../../../contexts/machine/domain/value-objects/machine-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { Money } from '../../../../shared/domain/value-objects/money.vo';
import { MachineOrmEntity } from '../entities/machine-orm.entity';

@Injectable()
export class MachineMapper {
  toDomain(orm: MachineOrmEntity): Machine {
    return Machine.restore({
      id: MachineId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      name: orm.name,
      model: orm.model,
      hourPrice: Money.fromCents(orm.hourPriceCents),
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: Machine, target: MachineOrmEntity = new MachineOrmEntity()): MachineOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.name = domain.name;
    target.model = domain.model;
    target.hourPriceCents = domain.hourPrice.cents;
    target.isActive = domain.isActive;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}
