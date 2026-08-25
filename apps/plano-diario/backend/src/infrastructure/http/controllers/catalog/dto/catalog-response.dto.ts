import { CatalogSyncResultDto } from '../../../../../contexts/catalog/application/dto/catalog-sync-result.dto';
import {
  DailyVideoDto,
  ResolvedVideoDto,
} from '../../../../../contexts/catalog/application/dto/daily-video.dto';
import { ListCatalogResult } from '../../../../../contexts/catalog/application/use-cases/list-catalog/list-catalog.use-case';

export class VideoResponseDto {
  dayNumber!: number;
  titleDayNumber!: number;
  title!: string;
  videoId!: string;
  url!: string;
  publishedAt!: Date | null;

  static fromDto(video: DailyVideoDto): VideoResponseDto {
    const dto = new VideoResponseDto();
    dto.dayNumber = video.dayNumber;
    dto.titleDayNumber = video.titleDayNumber;
    dto.title = video.title;
    dto.videoId = video.videoId;
    dto.url = video.url;
    dto.publishedAt = video.publishedAt;
    return dto;
  }
}

export class TodayResponseDto {
  dayNumber!: number;
  title!: string;
  videoId!: string;
  url!: string;
  formattedDate!: string;
  referenceDate!: string;
  /** Exatamente o texto que seria enviado no grupo — duas linhas. */
  messagePreview!: string;

  static fromDto(resolved: ResolvedVideoDto): TodayResponseDto {
    const dto = new TodayResponseDto();
    dto.dayNumber = resolved.dayNumber;
    dto.title = resolved.title;
    dto.videoId = resolved.videoId;
    dto.url = resolved.url;
    dto.formattedDate = resolved.formattedDate;
    dto.referenceDate = resolved.referenceDate;
    dto.messagePreview = `${resolved.formattedDate}\n${resolved.url}`;
    return dto;
  }
}

export class CatalogEntryResponseDto {
  dayNumber!: number;
  titleDayNumber!: number;
  scheduledDate!: string;
  formattedDate!: string;
  title!: string;
  videoId!: string;
  url!: string;
}

export class CatalogListResponseDto {
  planStartDate!: string;
  dayOffset!: number;
  total!: number;
  firstDay!: number | null;
  lastDay!: number | null;
  lastSyncedAt!: Date | null;
  entries!: CatalogEntryResponseDto[];

  static fromResult(result: ListCatalogResult): CatalogListResponseDto {
    const dto = new CatalogListResponseDto();
    dto.planStartDate = result.planStartDate;
    dto.dayOffset = result.dayOffset;
    dto.total = result.total;
    dto.firstDay = result.firstDay;
    dto.lastDay = result.lastDay;
    dto.lastSyncedAt = result.lastSyncedAt;
    dto.entries = result.entries.map((entry) => ({ ...entry }));
    return dto;
  }
}

export class CatalogSyncResponseDto {
  imported!: number;
  created!: number;
  updated!: number;
  skipped!: number;
  conflicts!: Array<{ titleDayNumber: number; videoIds: string[] }>;
  missingTitleNumbers!: number[];
  firstDay!: number | null;
  lastDay!: number | null;
  syncedAt!: Date;

  static fromDto(result: CatalogSyncResultDto): CatalogSyncResponseDto {
    const dto = new CatalogSyncResponseDto();
    dto.imported = result.imported;
    dto.created = result.created;
    dto.updated = result.updated;
    dto.skipped = result.skipped;
    dto.conflicts = result.conflicts;
    dto.missingTitleNumbers = result.missingTitleNumbers;
    dto.firstDay = result.firstDay;
    dto.lastDay = result.lastDay;
    dto.syncedAt = result.syncedAt;
    return dto;
  }
}
