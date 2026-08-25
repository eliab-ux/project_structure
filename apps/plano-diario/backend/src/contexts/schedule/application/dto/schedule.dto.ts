import { Schedule } from '../../domain/entities/schedule.entity';

export class ScheduleDto {
  id!: string;
  groupJid!: string;
  groupName!: string;
  sendTime!: string;
  timezone!: string;
  planStartDate!: string;
  dayOffset!: number;
  messageTemplate!: string;
  isActive!: boolean;
  updatedAt!: Date;

  static fromDomain(schedule: Schedule): ScheduleDto {
    const dto = new ScheduleDto();
    dto.id = schedule.id;
    dto.groupJid = schedule.groupJid;
    dto.groupName = schedule.groupName;
    dto.sendTime = schedule.sendTime.value;
    dto.timezone = schedule.timezone.value;
    dto.planStartDate = schedule.planStartDate;
    dto.dayOffset = schedule.dayOffset;
    dto.messageTemplate = schedule.messageTemplate.value;
    dto.isActive = schedule.isActive;
    dto.updatedAt = schedule.updatedAt;
    return dto;
  }
}
