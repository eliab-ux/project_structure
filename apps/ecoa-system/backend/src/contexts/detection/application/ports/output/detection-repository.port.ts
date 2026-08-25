import { Detection } from '../../../domain/entities/detection.entity';

export const DETECTION_REPOSITORY = Symbol('DETECTION_REPOSITORY');

export interface DetectionListFilters {
  watchlistOnly?: boolean;
  from?: Date;
  to?: Date;
  seen?: boolean;
  page: number;
  limit: number;
}

export interface DetectionSummaryResult {
  total: number;
  last7Days: number;
  last30Days: number;
  byAccount: Array<{ sourceUsername: string; count: number }>;
}

export interface DetectionRepositoryPort {
  save(detection: Detection): Promise<Detection>;
  findById(ownerId: string, id: string): Promise<Detection | null>;
  list(
    ownerId: string,
    filters: DetectionListFilters,
  ): Promise<{ items: Detection[]; total: number }>;
  summary(ownerId: string, now: Date): Promise<DetectionSummaryResult>;
}
