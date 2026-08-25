import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { VideoNotFoundForDayException } from '../../../domain/exceptions/video-not-found-for-day.exception';
import { addDays, formatPlanDate, resolveDayNumber } from '../../../domain/services/plan-date';
import { ResolvedVideoDto } from '../../dto/daily-video.dto';
import {
  DAILY_VIDEO_REPOSITORY,
  DailyVideoRepositoryPort,
} from '../../ports/output/daily-video-repository.port';

export interface ResolveVideoForDateCommand {
  /** Data local do usuário (`yyyy-MM-dd`) — quem converte o fuso é o chamador. */
  localDate: string;
  /** Dia 1 do plano (`yyyy-MM-dd`). */
  planStartDate: string;
  /**
   * Quantos dias à frente da data local está a leitura enviada.
   * `0` = envia a leitura do próprio dia; `1` = envia na véspera a leitura do dia seguinte.
   */
  dayOffset: number;
}

/**
 * O coração do sistema: data local → dia do plano → vídeo do catálogo.
 * A URL do vídeo NUNCA é derivada de cálculo de data; o cálculo só produz o número do dia,
 * e o vídeo vem do catálogo. Não achou → exceção, e o dispatch registra `failed` sem enviar.
 */
@Injectable()
export class ResolveVideoForDateUseCase implements UseCase<
  ResolveVideoForDateCommand,
  ResolvedVideoDto
> {
  constructor(
    @Inject(DAILY_VIDEO_REPOSITORY) private readonly repository: DailyVideoRepositoryPort,
  ) {}

  async execute(command: ResolveVideoForDateCommand): Promise<ResolvedVideoDto> {
    const dayNumber = resolveDayNumber(command.localDate, command.planStartDate, command.dayOffset);

    /**
     * A data que vai NA MENSAGEM é a data da leitura, não a de hoje.
     *
     * Sem isso, um envio na véspera diria "29 de JULHO" acompanhado do vídeo do dia 30 — o
     * cabeçalho contradizendo o conteúdo, que é o pior tipo de erro aqui: quem lê confia na data.
     * Com `dayOffset: 0` (o caso normal) o valor é idêntico ao anterior.
     */
    const readingDate = addDays(command.localDate, command.dayOffset);

    if (dayNumber < 1) {
      // Antes do início do plano — não existe dia 0 nem negativo.
      throw new VideoNotFoundForDayException(dayNumber);
    }

    const video = await this.repository.findByDayNumber(dayNumber);
    if (!video) {
      throw new VideoNotFoundForDayException(dayNumber);
    }

    // `referenceDate` continua sendo o dia do ENVIO: é a chave de idempotência do log diário
    // ("um envio por dia"), e trocá-la pela data da leitura quebraria essa garantia.
    return ResolvedVideoDto.from(video, formatPlanDate(readingDate), command.localDate);
  }
}
