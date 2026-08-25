import { DailyVideoRepositoryPort } from '../../../src/contexts/catalog/application/ports/output/daily-video-repository.port';
import { VideoSourcePort } from '../../../src/contexts/catalog/application/ports/output/video-source.port';
import { SyncCatalogUseCase } from '../../../src/contexts/catalog/application/use-cases/sync-catalog/sync-catalog.use-case';
import { DailyVideo } from '../../../src/contexts/catalog/domain/entities/daily-video.entity';
import { YoutubeVideoId } from '../../../src/contexts/catalog/domain/value-objects/youtube-video-id.vo';

// IDs com 11 caracteres, como os reais do YouTube — o VO rejeita ids curtos de propósito.
const VIDEO_1 = 'CXu5eYkX_Jg';
const VIDEO_2 = 'YrD-ritV3Is';
const SERMAO = 'zzTopSermao1';

const fonte = [
  { videoId: VIDEO_1, title: 'Dia 1 - Gênesis 1-3', playlistId: 'UU', publishedAt: null },
  { videoId: VIDEO_2, title: 'Dia 2 - Gênesis 4-7', playlistId: 'UU', publishedAt: null },
  { videoId: SERMAO, title: 'Culto de Gratidão', playlistId: 'UU', publishedAt: null },
];

describe('SyncCatalogUseCase', () => {
  let videoSource: jest.Mocked<VideoSourcePort>;
  let repository: jest.Mocked<DailyVideoRepositoryPort>;
  let useCase: SyncCatalogUseCase;

  beforeEach(() => {
    videoSource = { fetchAllChannelVideos: jest.fn().mockResolvedValue(fonte) };
    repository = {
      findByDayNumber: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      saveAll: jest.fn(),
      range: jest.fn(),
    };
    useCase = new SyncCatalogUseCase(videoSource, repository);
  });

  it('importa as leituras e ignora o que não é leitura', async () => {
    const result = await useCase.execute();

    expect(result).toMatchObject({ imported: 2, created: 2, updated: 0, skipped: 1 });
    expect(result.firstDay).toBe(1);
    expect(result.lastDay).toBe(2);
    expect(repository.saveAll).toHaveBeenCalledTimes(1);
    expect(repository.saveAll.mock.calls[0][0]).toHaveLength(2);
  });

  it('é idempotente: rodar de novo sem mudança não gera update', async () => {
    repository.findAll.mockResolvedValue([
      DailyVideo.create({
        dayNumber: 1,
        titleDayNumber: 1,
        title: 'Dia 1 - Gênesis 1-3',
        videoId: YoutubeVideoId.create(VIDEO_1),
        playlistId: 'UU',
        publishedAt: null,
      }),
      DailyVideo.create({
        dayNumber: 2,
        titleDayNumber: 2,
        title: 'Dia 2 - Gênesis 4-7',
        videoId: YoutubeVideoId.create(VIDEO_2),
        playlistId: 'UU',
        publishedAt: null,
      }),
    ]);

    const result = await useCase.execute();

    expect(result).toMatchObject({ created: 0, updated: 0 });
    expect(repository.saveAll).toHaveBeenCalledWith([]);
  });

  it('atualiza o dia quando o vídeo daquela posição mudou', async () => {
    repository.findAll.mockResolvedValue([
      DailyVideo.create({
        dayNumber: 1,
        titleDayNumber: 1,
        title: 'Dia 1 - título antigo',
        videoId: YoutubeVideoId.create('antigoVideo1'),
        playlistId: 'UU',
        publishedAt: null,
      }),
    ]);

    const result = await useCase.execute();

    expect(result).toMatchObject({ created: 1, updated: 1 });
    const salvos = repository.saveAll.mock.calls[0][0];
    expect(salvos.find((v) => v.dayNumber === 1)?.videoId.value).toBe(VIDEO_1);
  });

  it('falha na origem NÃO apaga nem escreve nada (catálogo anterior segue válido)', async () => {
    videoSource.fetchAllChannelVideos.mockRejectedValue(new Error('quotaExceeded'));

    await expect(useCase.execute()).rejects.toThrow('quotaExceeded');
    expect(repository.saveAll).not.toHaveBeenCalled();
  });

  it('reporta conflitos e números ausentes no resultado', async () => {
    videoSource.fetchAllChannelVideos.mockResolvedValue([
      { videoId: 'aaaaaaaaaaa', title: 'Dia 5 - x', playlistId: 'UU', publishedAt: new Date('2020-01-01') },
      { videoId: 'bbbbbbbbbbb', title: 'Dia 5 - y', playlistId: 'UU', publishedAt: new Date('2020-01-02') },
      { videoId: 'ccccccccccc', title: 'Dia 8 - z', playlistId: 'UU', publishedAt: new Date('2020-01-03') },
    ]);

    const result = await useCase.execute();

    expect(result.conflicts).toEqual([
      { titleDayNumber: 5, videoIds: ['aaaaaaaaaaa', 'bbbbbbbbbbb'] },
    ]);
    expect(result.missingTitleNumbers).toEqual([6, 7]);
  });
});
