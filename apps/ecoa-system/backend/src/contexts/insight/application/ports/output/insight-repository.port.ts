import { MediaInsightSnapshot } from '../../../domain/entities/media-insight-snapshot.entity';

export const INSIGHT_REPOSITORY = Symbol('INSIGHT_REPOSITORY');

export interface InsightRepositoryPort {
  save(snapshot: MediaInsightSnapshot): Promise<MediaInsightSnapshot>;
  /** Returns the media's snapshots ordered by captured_at ascending (time series). */
  findSeriesByMedia(ownerId: string, ownMediaId: string): Promise<MediaInsightSnapshot[]>;
}
