import { Injectable } from '@nestjs/common';
import { Schedule } from '../../../../contexts/schedule/domain/entities/schedule.entity';
import { MessageTemplate } from '../../../../contexts/schedule/domain/value-objects/message-template.vo';
import { SendTime } from '../../../../contexts/schedule/domain/value-objects/send-time.vo';
import { Timezone } from '../../../../contexts/schedule/domain/value-objects/timezone.vo';
import { ScheduleOrmEntity } from '../entities/schedule-orm.entity';

@Injectable()
export class ScheduleMapper {
  toDomain(orm: ScheduleOrmEntity): Schedule {
    return Schedule.reconstitute({
      id: orm.id,
      userId: orm.userId,
      groupJid: orm.groupJid,
      groupName: orm.groupName,
      // O Postgres devolve `time` como `HH:mm:ss`; o VO aceita `HH:mm`.
      sendTime: SendTime.create(String(orm.sendTime).slice(0, 5)),
      timezone: Timezone.create(orm.timezone),
      planStartDate: ScheduleMapper.toIsoDate(orm.planStartDate),
      dayOffset: orm.dayOffset,
      messageTemplate: MessageTemplate.create(orm.messageTemplate),
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: Schedule, existing?: ScheduleOrmEntity): ScheduleOrmEntity {
    const orm = existing ?? new ScheduleOrmEntity();
    orm.id = domain.id;
    orm.userId = domain.userId;
    orm.groupJid = domain.groupJid;
    orm.groupName = domain.groupName;
    orm.sendTime = domain.sendTime.value;
    orm.timezone = domain.timezone.value;
    orm.planStartDate = domain.planStartDate;
    orm.dayOffset = domain.dayOffset;
    orm.messageTemplate = domain.messageTemplate.value;
    orm.isActive = domain.isActive;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }

  /** `date` pode chegar como string ou Date dependendo do driver — normaliza para yyyy-MM-dd. */
  private static toIsoDate(value: string | Date): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  }
}
