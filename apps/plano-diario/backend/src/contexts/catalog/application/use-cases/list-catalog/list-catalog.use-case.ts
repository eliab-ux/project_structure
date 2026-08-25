import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { addDays, formatPlanDate } from '../../../domain/services/plan-date';
import {
  DAILY_VIDEO_REPOSITORY,
  DailyVideoRepositoryPort,
} from '../../ports/output/daily-video-repository.port';

export interface CatalogEntryView {
  dayNumber: number;
  titleDayNumber: number;
  /** Data em que este dia cai, dado o plano configurado (`yyyy-MM-dd`). */
  scheduledDate: string;
  /** A mesma data como sai na linha 1 da mensagem. */
  formattedDate: string;
  title: string;
  videoId: string;
  url: string;
}

export interface ListCatalogResult {
  planStartDate: string;
  dayOffset: number;
  total: number;
  firstDay: number | null;
  lastDay: number | null;
  lastSyncedAt: Date | null;
  entries: CatalogEntryView[];
}

/**
 * Catálogo inteiro com a data de cada dia já resolvida — é a tela de conferência humana:
 * permite validar o alinhamento data → leitura sem esperar o envio chegar no grupo.
 */
@Injectable()
export class ListCatalogUseCase implements UseCase<
  { planStartDate: string; dayOffset: number },
  ListCatalogResult
> {
  constructor(
    @Inject(DAILY_VIDEO_REPOSITORY) private readonly repository: DailyVideoRepositoryPort,
  ) {}

  async execute(command: { planStartDate: string; dayOffset: number }): Promise<ListCatalogResult> {
    const [videos, range] = await Promise.all([this.repository.findAll(), this.repository.range()]);

    const entries = videos
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((video) => {
        // Inverso de resolveDayNumber: dayNumber = diff + 1 + offset  →  diff = dayNumber - 1 - offset
        const scheduledDate = addDays(
          command.planStartDate,
          video.dayNumber - 1 - command.dayOffset,
        );
        return {
          dayNumber: video.dayNumber,
          titleDayNumber: video.titleDayNumber,
          scheduledDate,
          formattedDate: formatPlanDate(scheduledDate),
          title: video.title,
          videoId: video.videoId.value,
          url: video.videoId.shortUrl,
        };
      });

    return {
      planStartDate: command.planStartDate,
      dayOffset: command.dayOffset,
      total: range.total,
      firstDay: range.firstDay,
      lastDay: range.lastDay,
      lastSyncedAt: range.lastSyncedAt,
      entries,
    };
  }
}
