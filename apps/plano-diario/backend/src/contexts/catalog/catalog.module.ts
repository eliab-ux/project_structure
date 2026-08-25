import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule } from '@nestjs/config';
import { DailyVideoOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/daily-video-orm.entity';
import { DailyVideoMapper } from '../../infrastructure/persistence/mikro-orm/mappers/daily-video.mapper';
import { MikroOrmDailyVideoRepository } from '../../infrastructure/persistence/mikro-orm/repositories/daily-video.repository';
import { YoutubeDataApiAdapter } from '../../infrastructure/youtube/youtube-data-api.adapter';
import { YoutubeThumbnailAdapter } from '../../infrastructure/youtube/youtube-thumbnail.adapter';
import { DAILY_VIDEO_REPOSITORY } from './application/ports/output/daily-video-repository.port';
import { VIDEO_SOURCE } from './application/ports/output/video-source.port';
import { VIDEO_THUMBNAIL } from './application/ports/output/video-thumbnail.port';
import { GetVideoByDayUseCase } from './application/use-cases/get-video-by-day/get-video-by-day.use-case';
import { ListCatalogUseCase } from './application/use-cases/list-catalog/list-catalog.use-case';
import { ResolveVideoForDateUseCase } from './application/use-cases/resolve-video-for-date/resolve-video-for-date.use-case';
import { SyncCatalogUseCase } from './application/use-cases/sync-catalog/sync-catalog.use-case';

@Module({
  imports: [ConfigModule, MikroOrmModule.forFeature([DailyVideoOrmEntity])],
  providers: [
    DailyVideoMapper,
    { provide: DAILY_VIDEO_REPOSITORY, useClass: MikroOrmDailyVideoRepository },
    { provide: VIDEO_SOURCE, useClass: YoutubeDataApiAdapter },
    { provide: VIDEO_THUMBNAIL, useClass: YoutubeThumbnailAdapter },
    SyncCatalogUseCase,
    GetVideoByDayUseCase,
    ResolveVideoForDateUseCase,
    ListCatalogUseCase,
  ],
  exports: [
    DAILY_VIDEO_REPOSITORY,
    // Exportado porque quem envia (dispatch) precisa da miniatura para a mensagem sair com o
    // vídeo visível; o adapter em si continua invisível fora daqui.
    VIDEO_THUMBNAIL,
    SyncCatalogUseCase,
    GetVideoByDayUseCase,
    ResolveVideoForDateUseCase,
    ListCatalogUseCase,
  ],
})
export class CatalogModule {}
