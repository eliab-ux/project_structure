import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  VIDEO_THUMBNAIL,
  VideoThumbnailPort,
} from '../../../../catalog/application/ports/output/video-thumbnail.port';
import { ResolveVideoForDateUseCase } from '../../../../catalog/application/use-cases/resolve-video-for-date/resolve-video-for-date.use-case';
import {
  SCHEDULE_REPOSITORY,
  ScheduleRepositoryPort,
} from '../../../../schedule/application/ports/output/schedule-repository.port';
import {
  WHATSAPP_GATEWAY,
  WhatsappGatewayPort,
} from '../../../../whatsapp/application/ports/output/whatsapp-gateway.port';
import {
  WHATSAPP_INSTANCE_REPOSITORY,
  WhatsappInstanceRepositoryPort,
} from '../../../../whatsapp/application/ports/output/whatsapp-instance-repository.port';
import { DispatchLog } from '../../../domain/entities/dispatch-log.entity';
import { DispatchTriggerValue } from '../../../domain/value-objects/dispatch-status.vo';
import {
  DISPATCH_LOG_REPOSITORY,
  DispatchLogRepositoryPort,
} from '../../ports/output/dispatch-log-repository.port';

export interface ExecuteDispatchCommand {
  scheduleId: string;
  /** Data local do usuário (`yyyy-MM-dd`) — quem converte o fuso é o chamador. */
  referenceDate: string;
  trigger: DispatchTriggerValue;
  /** Quando o retry do BullMQ reaproveita um log existente. */
  existingLogId?: string;
}

export interface ExecuteDispatchResult {
  status: 'sent' | 'failed' | 'duplicate';
  logId?: string;
  message?: string;
  reason?: string;
}

/**
 * O envio em si. Ordem deliberada (spec §8.1):
 *
 *  1. INSERT do log `pending` — se a UNIQUE do banco recusar, já foi enviado hoje: aborta em
 *     silêncio, sem tratar como erro;
 *  2. instância conectada? senão `failed`;
 *  3. resolve o vídeo do dia — não achou, `failed` e NADA é enviado;
 *  4. monta a mensagem pelo template, busca a miniatura e envia;
 *  5. grava o resultado.
 *
 * O passo 1 vir ANTES de tudo é o que impede envio duplicado: dois workers que rodem no mesmo
 * minuto competem no INSERT, e só um passa.
 */
@Injectable()
export class ExecuteDispatchUseCase implements UseCase<
  ExecuteDispatchCommand,
  ExecuteDispatchResult
> {
  private readonly logger = new Logger(ExecuteDispatchUseCase.name);

  constructor(
    @Inject(DISPATCH_LOG_REPOSITORY) private readonly logs: DispatchLogRepositoryPort,
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepositoryPort,
    @Inject(WHATSAPP_INSTANCE_REPOSITORY)
    private readonly instances: WhatsappInstanceRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsappGatewayPort,
    @Inject(VIDEO_THUMBNAIL) private readonly thumbnails: VideoThumbnailPort,
    private readonly resolveVideo: ResolveVideoForDateUseCase,
  ) {}

  async execute(command: ExecuteDispatchCommand): Promise<ExecuteDispatchResult> {
    const schedule = await this.schedules.findById(command.scheduleId);
    if (!schedule) {
      return { status: 'failed', reason: 'Agendamento não encontrado' };
    }

    const log = await this.acquireLog(command, schedule.userId);
    if (!log) {
      // Já existe envio agendado para esta data — comportamento esperado, não erro.
      this.logger.log('Envio já registrado para hoje; ignorando', {
        scheduleId: command.scheduleId,
        referenceDate: command.referenceDate,
      });
      return { status: 'duplicate' };
    }

    const instance = await this.instances.findByUserId(schedule.userId);
    if (!instance || !instance.status.isConnected) {
      return this.fail(log, 'WhatsApp não conectado');
    }

    let resolved;
    try {
      resolved = await this.resolveVideo.execute({
        localDate: command.referenceDate,
        planStartDate: schedule.planStartDate,
        dayOffset: schedule.dayOffset,
      });
    } catch (error) {
      // Nunca um vídeo aproximado, nunca o do dia anterior: se não achou, não envia.
      return this.fail(log, (error as Error)?.message ?? 'Vídeo do dia não encontrado');
    }

    log.resolveVideo({ dayNumber: resolved.dayNumber, videoId: resolved.videoId });

    const message = schedule.buildMessage({
      formattedDate: resolved.formattedDate,
      url: resolved.url,
    });

    // A miniatura é buscada ANTES de qualquer envio, e nunca interrompe o dia: se não vier,
    // a leitura sai como texto. O que não pode acontecer é tentar imagem, falhar, e tentar texto
    // depois — o primeiro POST pode ter sido entregue, e o grupo receberia a leitura duas vezes.
    const thumbnail = await this.thumbnails.fetch(resolved.videoId);

    try {
      if (thumbnail) {
        await this.gateway.sendImageWithCaption(
          instance.instanceName.value,
          instance.token,
          schedule.groupJid,
          { base64: thumbnail.base64, mimeType: thumbnail.mimeType, caption: message },
        );
      } else {
        await this.gateway.sendText(
          instance.instanceName.value,
          instance.token,
          schedule.groupJid,
          message,
        );
      }
    } catch (error) {
      return this.fail(log, (error as Error)?.message ?? 'Falha ao enviar a mensagem');
    }

    log.markSent(message);
    await this.logs.save(log);
    this.logger.log('Mensagem enviada', {
      userId: schedule.userId,
      dayNumber: resolved.dayNumber,
      referenceDate: command.referenceDate,
      trigger: command.trigger,
      // Registra o formato que saiu: sem isso, "chegou sem a imagem" é indepurável.
      format: thumbnail ? 'image' : 'text',
    });
    return { status: 'sent', logId: log.id, message };
  }

  /**
   * Reaproveita o log quando é retry do BullMQ; senão tenta criar. `null` = duplicado.
   */
  private async acquireLog(
    command: ExecuteDispatchCommand,
    userId: string,
  ): Promise<DispatchLog | null> {
    if (command.existingLogId) {
      return this.logs.findById(command.existingLogId);
    }
    return this.logs.createPending(
      DispatchLog.createPending({
        userId,
        scheduleId: command.scheduleId,
        referenceDate: command.referenceDate,
        trigger: command.trigger,
      }),
    );
  }

  private async fail(log: DispatchLog, reason: string): Promise<ExecuteDispatchResult> {
    log.markFailed(reason);
    await this.logs.save(log);
    this.logger.warn('Envio falhou', {
      logId: log.id,
      // `errorReason` já passou pela sanitização da entidade.
      reason: log.errorReason,
      attempts: log.attempts,
    });
    return { status: 'failed', logId: log.id, reason: log.errorReason ?? reason };
  }
}
