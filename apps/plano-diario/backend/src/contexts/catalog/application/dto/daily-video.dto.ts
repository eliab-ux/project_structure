import { DailyVideo } from '../../domain/entities/daily-video.entity';

export class DailyVideoDto {
  dayNumber!: number;
  titleDayNumber!: number;
  title!: string;
  videoId!: string;
  url!: string;
  publishedAt!: Date | null;

  static fromDomain(video: DailyVideo): DailyVideoDto {
    const dto = new DailyVideoDto();
    dto.dayNumber = video.dayNumber;
    dto.titleDayNumber = video.titleDayNumber;
    dto.title = video.title;
    dto.videoId = video.videoId.value;
    dto.url = video.videoId.shortUrl;
    dto.publishedAt = video.publishedAt;
    return dto;
  }
}

/** O vídeo de uma data específica, já com a data formatada como sai na mensagem. */
export class ResolvedVideoDto {
  dayNumber!: number;
  title!: string;
  videoId!: string;
  url!: string;
  /** `28 de JULHO` — linha 1 da mensagem. */
  formattedDate!: string;
  /** Data local usada na resolução (`yyyy-MM-dd`). */
  referenceDate!: string;

  static from(video: DailyVideo, formattedDate: string, referenceDate: string): ResolvedVideoDto {
    const dto = new ResolvedVideoDto();
    dto.dayNumber = video.dayNumber;
    dto.title = video.title;
    dto.videoId = video.videoId.value;
    dto.url = video.videoId.shortUrl;
    dto.formattedDate = formattedDate;
    dto.referenceDate = referenceDate;
    return dto;
  }
}
