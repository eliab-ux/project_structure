import { DispatchLog } from '../../domain/entities/dispatch-log.entity';

export class DispatchLogDto {
  id!: string;
  referenceDate!: string;
  dayNumber!: number | null;
  videoId!: string | null;
  url!: string | null;
  messageSent!: string | null;
  status!: string;
  errorReason!: string | null;
  attempts!: number;
  sentAt!: Date | null;
  trigger!: string;
  createdAt!: Date;

  static fromDomain(log: DispatchLog): DispatchLogDto {
    const dto = new DispatchLogDto();
    dto.id = log.id;
    dto.referenceDate = log.referenceDate;
    dto.dayNumber = log.dayNumber;
    dto.videoId = log.videoId;
    dto.url = log.videoId ? `https://youtu.be/${log.videoId}` : null;
    dto.messageSent = log.messageSent;
    dto.status = log.status.value;
    // Já sanitizado na entidade — seguro para exibir na tela de histórico.
    dto.errorReason = log.errorReason;
    dto.attempts = log.attempts;
    dto.sentAt = log.sentAt;
    dto.trigger = log.trigger;
    dto.createdAt = log.createdAt;
    return dto;
  }
}
