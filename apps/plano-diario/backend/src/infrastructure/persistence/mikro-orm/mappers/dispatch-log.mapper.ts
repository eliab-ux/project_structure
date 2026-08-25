import { Injectable } from '@nestjs/common';
import { DispatchLog } from '../../../../contexts/dispatch/domain/entities/dispatch-log.entity';
import {
  DispatchStatus,
  DispatchTriggerValue,
} from '../../../../contexts/dispatch/domain/value-objects/dispatch-status.vo';
import { DispatchLogOrmEntity } from '../entities/dispatch-log-orm.entity';

@Injectable()
export class DispatchLogMapper {
  toDomain(orm: DispatchLogOrmEntity): DispatchLog {
    return DispatchLog.reconstitute({
      id: orm.id,
      userId: orm.userId,
      scheduleId: orm.scheduleId,
      referenceDate: DispatchLogMapper.toIsoDate(orm.referenceDate),
      trigger: orm.trigger as DispatchTriggerValue,
      dayNumber: orm.dayNumber ?? null,
      videoId: orm.videoId ?? null,
      messageSent: orm.messageSent ?? null,
      status: DispatchStatus.from(orm.status),
      errorReason: orm.errorReason ?? null,
      attempts: orm.attempts,
      sentAt: orm.sentAt ?? null,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(domain: DispatchLog, existing?: DispatchLogOrmEntity): DispatchLogOrmEntity {
    const orm = existing ?? new DispatchLogOrmEntity();
    orm.id = domain.id;
    orm.userId = domain.userId;
    orm.scheduleId = domain.scheduleId;
    orm.referenceDate = domain.referenceDate;
    orm.dayNumber = domain.dayNumber;
    orm.videoId = domain.videoId;
    orm.messageSent = domain.messageSent;
    orm.status = domain.status.value;
    orm.errorReason = domain.errorReason;
    orm.attempts = domain.attempts;
    orm.sentAt = domain.sentAt;
    orm.trigger = domain.trigger;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }

  private static toIsoDate(value: string | Date): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  }
}
