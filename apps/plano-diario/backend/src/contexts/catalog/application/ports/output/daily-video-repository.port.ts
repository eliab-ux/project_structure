import { DailyVideo } from '../../../domain/entities/daily-video.entity';

export const DAILY_VIDEO_REPOSITORY = Symbol('DAILY_VIDEO_REPOSITORY');

export interface CatalogRange {
  total: number;
  firstDay: number | null;
  lastDay: number | null;
  lastSyncedAt: Date | null;
}

export interface DailyVideoRepositoryPort {
  findByDayNumber(dayNumber: number): Promise<DailyVideo | null>;
  findAll(): Promise<DailyVideo[]>;
  /** Upsert em lote por `dayNumber`. Nunca apaga o catálogo anterior. */
  saveAll(videos: DailyVideo[]): Promise<void>;
  range(): Promise<CatalogRange>;
}
