import { ScheduleDto } from '../../../../../contexts/schedule/application/dto/schedule.dto';

export class ScheduleResponseDto {
  /** `null` quando o usuário ainda não configurou nada. */
  configured!: boolean;
  groupJid!: string | null;
  groupName!: string | null;
  sendTime!: string | null;
  timezone!: string | null;
  planStartDate!: string | null;
  dayOffset!: number | null;
  messageTemplate!: string | null;
  isActive!: boolean;

  static fromDto(schedule: ScheduleDto | null): ScheduleResponseDto {
    const dto = new ScheduleResponseDto();
    dto.configured = schedule !== null;
    dto.groupJid = schedule?.groupJid ?? null;
    dto.groupName = schedule?.groupName ?? null;
    dto.sendTime = schedule?.sendTime ?? null;
    dto.timezone = schedule?.timezone ?? null;
    dto.planStartDate = schedule?.planStartDate ?? null;
    dto.dayOffset = schedule?.dayOffset ?? null;
    dto.messageTemplate = schedule?.messageTemplate ?? null;
    dto.isActive = schedule?.isActive ?? false;
    return dto;
  }
}
