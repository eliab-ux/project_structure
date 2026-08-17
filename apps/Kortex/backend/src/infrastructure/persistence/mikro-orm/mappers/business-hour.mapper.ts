import { Injectable } from '@nestjs/common';
import { BusinessHour } from '../../../../contexts/account/domain/entities/business-hour.entity';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { BusinessHourId } from '../../../../contexts/account/domain/value-objects/business-hour-id.vo';
import { TimeOfDay } from '../../../../shared/domain/value-objects/time-of-day.vo';
import { BusinessHourOrmEntity } from '../entities/business-hour-orm.entity';

@Injectable()
export class BusinessHourMapper {
  toDomain(orm: BusinessHourOrmEntity): BusinessHour {
    return BusinessHour.restore({
      id: BusinessHourId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      weekday: orm.weekday,
      startsAt: TimeOfDay.create(orm.startsAt),
      endsAt: TimeOfDay.create(orm.endsAt),
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(
    domain: BusinessHour,
    target: BusinessHourOrmEntity = new BusinessHourOrmEntity(),
  ): BusinessHourOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.weekday = domain.weekday;
    target.startsAt = domain.startsAt.value;
    target.endsAt = domain.endsAt.value;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}
