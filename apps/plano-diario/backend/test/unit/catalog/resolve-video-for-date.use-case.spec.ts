import { DailyVideoRepositoryPort } from '../../../src/contexts/catalog/application/ports/output/daily-video-repository.port';
import { ResolveVideoForDateUseCase } from '../../../src/contexts/catalog/application/use-cases/resolve-video-for-date/resolve-video-for-date.use-case';
import { DailyVideo } from '../../../src/contexts/catalog/domain/entities/daily-video.entity';
import { VideoNotFoundForDayException } from '../../../src/contexts/catalog/domain/exceptions/video-not-found-for-day.exception';
import { YoutubeVideoId } from '../../../src/contexts/catalog/domain/value-objects/youtube-video-id.vo';

function dailyVideo(dayNumber: number, videoId: string, titleDayNumber = dayNumber): DailyVideo {
  return DailyVideo.create({
    dayNumber,
    titleDayNumber,
    title: `Dia ${titleDayNumber} - Leitura`,
    videoId: YoutubeVideoId.create(videoId),
    playlistId: 'UU-uploads',
    publishedAt: null,
  });
}

describe('ResolveVideoForDateUseCase', () => {
  let repository: jest.Mocked<DailyVideoRepositoryPort>;
  let useCase: ResolveVideoForDateUseCase;

  beforeEach(() => {
    repository = {
      findByDayNumber: jest.fn(),
      findAll: jest.fn(),
      saveAll: jest.fn(),
      range: jest.fn(),
    };
    useCase = new ResolveVideoForDateUseCase(repository);
  });

  it('resolve a data local para o vídeo do dia e formata a linha 1', async () => {
    // 28/07/2026 é a posição 209 do plano — o vídeo intitulado "Dia 209 - Isaías 29-31".
    repository.findByDayNumber.mockResolvedValue(dailyVideo(209, 'Mr_WsXKXN30', 209));

    const resolved = await useCase.execute({
      localDate: '2026-07-28',
      planStartDate: '2026-01-01',
      dayOffset: 0,
    });

    expect(repository.findByDayNumber).toHaveBeenCalledWith(209);
    expect(resolved.formattedDate).toBe('28 de JULHO');
    expect(resolved.url).toBe('https://youtu.be/Mr_WsXKXN30');
    // Sem `?si=` — o parâmetro de tracking do botão Compartilhar não entra na mensagem.
    expect(resolved.url).not.toContain('?');
  });

  it('dia sem vídeo no catálogo → exceção, e NENHUM fallback é consultado', async () => {
    repository.findByDayNumber.mockResolvedValue(null);

    await expect(
      useCase.execute({ localDate: '2026-10-03', planStartDate: '2026-01-01', dayOffset: 0 }),
    ).rejects.toThrow(VideoNotFoundForDayException);

    // Uma única consulta: não tenta o dia anterior, não tenta aproximar.
    expect(repository.findByDayNumber).toHaveBeenCalledTimes(1);
  });

  it('data anterior ao início do plano nem consulta o banco', async () => {
    await expect(
      useCase.execute({ localDate: '2025-12-30', planStartDate: '2026-01-01', dayOffset: 0 }),
    ).rejects.toThrow(VideoNotFoundForDayException);

    expect(repository.findByDayNumber).not.toHaveBeenCalled();
  });

  it('a mensagem de erro identifica o dia que faltou', async () => {
    repository.findByDayNumber.mockResolvedValue(null);

    await expect(
      useCase.execute({ localDate: '2026-07-28', planStartDate: '2026-01-01', dayOffset: 0 }),
    ).rejects.toThrow('Vídeo do dia 209 não encontrado no catálogo');
  });

  it('day_offset desloca o dia resolvido', async () => {
    repository.findByDayNumber.mockResolvedValue(dailyVideo(208, 'aSi0uip5XHg'));

    await useCase.execute({
      localDate: '2026-07-28',
      planStartDate: '2026-01-01',
      dayOffset: -1,
    });

    expect(repository.findByDayNumber).toHaveBeenCalledWith(208);
  });

  describe('envio na véspera (dayOffset 1)', () => {
    it('resolve o vídeo do dia SEGUINTE e datA a mensagem com o dia seguinte', async () => {
      repository.findByDayNumber.mockResolvedValue(dailyVideo(210, 'Ml1Aq5NJno0', 210));

      const resolved = await useCase.execute({
        localDate: '2026-07-28',
        planStartDate: '2026-01-01',
        dayOffset: 1,
      });

      expect(repository.findByDayNumber).toHaveBeenCalledWith(210);
      // O ponto da correção: a data na mensagem é a da LEITURA, não a de hoje. Dizer
      // "28 de JULHO" ao lado do vídeo do dia 29 seria o cabeçalho contradizendo o conteúdo.
      expect(resolved.formattedDate).toBe('29 de JULHO');
    });

    it('a data da mensagem atravessa a virada do mês', async () => {
      repository.findByDayNumber.mockResolvedValue(dailyVideo(213, 'video-213', 213));

      const resolved = await useCase.execute({
        localDate: '2026-07-31',
        planStartDate: '2026-01-01',
        dayOffset: 1,
      });

      expect(resolved.formattedDate).toBe('1 de AGOSTO');
    });

    it('referenceDate continua sendo o dia do ENVIO, não o da leitura', async () => {
      repository.findByDayNumber.mockResolvedValue(dailyVideo(210, 'Ml1Aq5NJno0', 210));

      const resolved = await useCase.execute({
        localDate: '2026-07-28',
        planStartDate: '2026-01-01',
        dayOffset: 1,
      });

      // É a chave de idempotência do "um envio por dia" — trocá-la pela data da leitura
      // permitiria dois envios no mesmo dia.
      expect(resolved.referenceDate).toBe('2026-07-28');
    });
  });
});
