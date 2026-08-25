import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { DailyVideo } from '../../../domain/entities/daily-video.entity';
import { buildReadingSequence } from '../../../domain/services/reading-sequence';
import { YoutubeVideoId } from '../../../domain/value-objects/youtube-video-id.vo';
import { CatalogSyncResultDto } from '../../dto/catalog-sync-result.dto';
import {
  DAILY_VIDEO_REPOSITORY,
  DailyVideoRepositoryPort,
} from '../../ports/output/daily-video-repository.port';
import { VIDEO_SOURCE, VideoSourcePort } from '../../ports/output/video-source.port';

@Injectable()
export class SyncCatalogUseCase implements UseCase<void, CatalogSyncResultDto> {
  private readonly logger = new Logger(SyncCatalogUseCase.name);

  constructor(
    @Inject(VIDEO_SOURCE) private readonly videoSource: VideoSourcePort,
    @Inject(DAILY_VIDEO_REPOSITORY) private readonly repository: DailyVideoRepositoryPort,
  ) {}

  async execute(): Promise<CatalogSyncResultDto> {
    // Se a busca falhar, a exceção sobe e NADA é escrito: o catálogo anterior continua válido.
    // Sync com falha nunca apaga dados — o envio do dia seguinte ainda funciona.
    const sourceVideos = await this.videoSource.fetchAllChannelVideos();
    const sequence = buildReadingSequence(sourceVideos);

    const existing = new Map(
      (await this.repository.findAll()).map((video) => [video.dayNumber, video]),
    );

    const toPersist: DailyVideo[] = [];
    let created = 0;
    let updated = 0;

    for (const item of sequence.items) {
      const videoId = YoutubeVideoId.create(item.videoId);
      const current = existing.get(item.position);

      if (!current) {
        toPersist.push(
          DailyVideo.create({
            dayNumber: item.position,
            titleDayNumber: item.titleDayNumber,
            title: item.title,
            videoId,
            playlistId: item.playlistId,
            publishedAt: item.publishedAt,
          }),
        );
        created += 1;
        continue;
      }

      if (
        current.differsFrom({
          titleDayNumber: item.titleDayNumber,
          title: item.title,
          videoId: item.videoId,
        })
      ) {
        current.refreshFrom({
          titleDayNumber: item.titleDayNumber,
          title: item.title,
          videoId,
          playlistId: item.playlistId,
          publishedAt: item.publishedAt,
        });
        toPersist.push(current);
        updated += 1;
      }
    }

    await this.repository.saveAll(toPersist);

    for (const conflict of sequence.duplicates) {
      this.logger.warn('Número de dia duplicado no título dos vídeos', {
        titleDayNumber: conflict.titleDayNumber,
        videoIds: conflict.videoIds,
      });
    }
    if (sequence.missingTitleNumbers.length > 0) {
      this.logger.warn('Números de dia ausentes na origem', {
        missing: sequence.missingTitleNumbers,
      });
    }
    // Títulos sem número de dia são conteúdo normal do canal (sermões, cursos) — nível warn
    // agregado, não erro, e sem despejar 300 títulos no log.
    this.logger.log('Sync do catálogo concluída', {
      imported: sequence.items.length,
      created,
      updated,
      skipped: sequence.skipped.length,
    });

    const result = new CatalogSyncResultDto();
    result.imported = sequence.items.length;
    result.created = created;
    result.updated = updated;
    result.skipped = sequence.skipped.length;
    result.conflicts = sequence.duplicates;
    result.missingTitleNumbers = sequence.missingTitleNumbers;
    result.firstDay = sequence.items.length > 0 ? sequence.items[0].position : null;
    result.lastDay =
      sequence.items.length > 0 ? sequence.items[sequence.items.length - 1].position : null;
    result.syncedAt = new Date();
    return result;
  }
}
