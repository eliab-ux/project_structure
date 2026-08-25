import { DispatchLogDto } from '../../../../../contexts/dispatch/application/dto/dispatch-log.dto';
import { SendNowResult } from '../../../../../contexts/dispatch/application/use-cases/send-now/send-now.use-case';

export class DispatchLogResponseDto {
  id!: string;
  referenceDate!: string;
  dayNumber!: number | null;
  url!: string | null;
  messageSent!: string | null;
  status!: string;
  errorReason!: string | null;
  attempts!: number;
  sentAt!: Date | null;
  trigger!: string;
  createdAt!: Date;

  static fromDto(log: DispatchLogDto): DispatchLogResponseDto {
    const dto = new DispatchLogResponseDto();
    dto.id = log.id;
    dto.referenceDate = log.referenceDate;
    dto.dayNumber = log.dayNumber;
    dto.url = log.url;
    dto.messageSent = log.messageSent;
    dto.status = log.status;
    dto.errorReason = log.errorReason;
    dto.attempts = log.attempts;
    dto.sentAt = log.sentAt;
    dto.trigger = log.trigger;
    dto.createdAt = log.createdAt;
    return dto;
  }
}

export class SendNowResponseDto {
  status!: string;
  message!: string | null;
  reason!: string | null;

  static from(result: SendNowResult): SendNowResponseDto {
    const dto = new SendNowResponseDto();
    dto.status = result.status;
    dto.message = result.message ?? null;
    dto.reason = result.reason ?? null;
    return dto;
  }
}
