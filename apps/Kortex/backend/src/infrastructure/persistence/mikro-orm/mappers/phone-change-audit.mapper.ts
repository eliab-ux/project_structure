import { Injectable } from '@nestjs/common';
import { PhoneChangeAudit } from '../../../../contexts/user/domain/entities/phone-change-audit.entity';
import { PhoneChangeAuditId } from '../../../../contexts/user/domain/value-objects/phone-change-audit-id.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { UserPhoneChangeAuditOrmEntity } from '../entities/user-phone-change-audit-orm.entity';

@Injectable()
export class PhoneChangeAuditMapper {
  toDomain(orm: UserPhoneChangeAuditOrmEntity): PhoneChangeAudit {
    return PhoneChangeAudit.restore({
      id: PhoneChangeAuditId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      userId: UserId.from(orm.userId),
      changedByUserId: UserId.from(orm.changedByUserId),
      previousPhone: PhoneE164.create(orm.previousPhone),
      newPhone: PhoneE164.create(orm.newPhone),
      createdAt: orm.createdAt,
    });
  }

  toOrm(
    domain: PhoneChangeAudit,
    target: UserPhoneChangeAuditOrmEntity = new UserPhoneChangeAuditOrmEntity(),
  ): UserPhoneChangeAuditOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.userId = domain.userId.value;
    target.changedByUserId = domain.changedByUserId.value;
    target.previousPhone = domain.previousPhone.value;
    target.newPhone = domain.newPhone.value;
    target.createdAt = domain.createdAt;
    return target;
  }
}
