import { Injectable } from '@nestjs/common';
import { DailyVideo } from '../../../../contexts/catalog/domain/entities/daily-video.entity';
import { YoutubeVideoId } from '../../../../contexts/catalog/domain/value-objects/youtube-video-id.vo';
import { DailyVideoOrmEntity } from '../entities/daily-video-orm.entity';

@Injectable()
export class DailyVideoMapper {
  toDomain(orm: DailyVideoOrmEntity): DailyVideo {
    return DailyVideo.create({
      dayNumber: orm.dayNumber,
      titleDayNumber: orm.titleDayNumber,
      title: orm.title,
      videoId: YoutubeVideoId.create(orm.videoId),
      playlistId: orm.playlistId,
      publishedAt: orm.publishedAt ?? null,
      syncedAt: orm.syncedAt,
    });
  }

  toOrm(domain: DailyVideo, existing?: DailyVideoOrmEntity): DailyVideoOrmEntity {
    const orm = existing ?? new DailyVideoOrmEntity();
    orm.dayNumber = domain.dayNumber;
    orm.titleDayNumber = domain.titleDayNumber;
    // O título do YouTube pode passar de 255 chars; truncar aqui evita erro de coluna
    // no meio de uma sync de 363 vídeos.
    orm.title = domain.title.slice(0, 255);
    orm.videoId = domain.videoId.value;
    orm.playlistId = domain.playlistId;
    orm.publishedAt = domain.publishedAt;
    orm.syncedAt = domain.syncedAt;
    return orm;
  }
}
