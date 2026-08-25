import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { localDateInTimeZone, localTimeInTimeZone } from '../../../../../shared/plan/local-date';
import {
  SCHEDULE_REPOSITORY,
  ScheduleRepositoryPort,
} from '../../../../schedule/application/ports/output/schedule-repository.port';
import { Schedule } from '../../../../schedule/domain/entities/schedule.entity';
import { SendTime } from '../../../../schedule/domain/value-objects/send-time.vo';
import { DispatchLog } from '../../../domain/entities/dispatch-log.entity';
import {
  DISPATCH_LOG_REPOSITORY,
  DispatchLogRepositoryPort,
} from '../../ports/output/dispatch-log-repository.port';

export interface DispatchDue {
  scheduleId: string;
  userId: string;
  referenceDate: string;
  reason: 'on-time' | 'catch-up';
  /**
   * Log já existente do dia, quando houver. Sem isso o catch-up de um dia que FALHOU nunca
   * recupera: o `createPending` bate na unique parcial, devolve "duplicado" e o envio é
   * abandonado — o dia fica falhado para sempre.
   */
  existingLogId?: string;
}

export interface PlanDispatchTickCommand {
  /** Injetável para teste — em produção é `new Date()`. */
  now?: Date;
  catchUpWindowHours: number;
}

/**
 * Decide, a cada minuto, quais agendamentos devem ser enviados AGORA.
 *
 * Um único tick para todos os usuários, em vez de um job repetível por usuário: assim trocar o
 * horário não exige reconciliar filas, qualquer timezone funciona, e reiniciar o processo não
 * perde agendamento nenhum.
 *
 * Duas razões para disparar:
 *  - `on-time`: a hora local do usuário é exatamente o horário configurado (comparação por minuto);
 *  - `catch-up`: o horário já passou hoje, ainda não houve envio, e estamos dentro da janela
 *    (default 3h). Isso cobre o processo ter ficado fora no minuto exato. Passada a janela,
 *    o dia é marcado `skipped` — mandar a leitura do dia às 23h não faz sentido.
 */
@Injectable()
export class PlanDispatchTickUseCase implements UseCase<PlanDispatchTickCommand, DispatchDue[]> {
  private readonly logger = new Logger(PlanDispatchTickUseCase.name);

  /**
   * De quantos em quantos ticks sai o batimento no log.
   *
   * O tick era completamente silencioso quando não achava ninguém devido — e aí "não enviou"
   * ficava indistinguível de "o agendador nem está rodando", que é exatamente a dúvida que
   * aparece quando algo falha. 15 minutos é raro o suficiente para não poluir o log e frequente
   * o suficiente para responder essa pergunta olhando os últimos minutos.
   */
  private static readonly HEARTBEAT_EVERY_TICKS = 15;

  private tickCount = 0;

  constructor(
    @Inject(SCHEDULE_REPOSITORY) private readonly schedules: ScheduleRepositoryPort,
    @Inject(DISPATCH_LOG_REPOSITORY) private readonly logs: DispatchLogRepositoryPort,
  ) {}

  async execute(command: PlanDispatchTickCommand): Promise<DispatchDue[]> {
    const now = command.now ?? new Date();
    const due: DispatchDue[] = [];

    const active = await this.schedules.findAllActive();
    this.heartbeat(now, active);

    for (const schedule of active) {
      const localDate = localDateInTimeZone(now, schedule.timezone.value);
      const localTime = localTimeInTimeZone(now, schedule.timezone.value);
      const nowMinutes = SendTime.create(localTime).minutesOfDay;
      const targetMinutes = schedule.sendTime.minutesOfDay;

      if (nowMinutes === targetMinutes) {
        const existing = await this.logs.findScheduledFor(schedule.id, localDate);
        if (existing?.status.isSent) {
          this.explain(schedule.id, 'ja-enviado-hoje', { localDate });
          continue;
        }
        due.push({
          scheduleId: schedule.id,
          userId: schedule.userId,
          referenceDate: localDate,
          reason: 'on-time',
          existingLogId: existing?.id,
        });
        continue;
      }

      if (nowMinutes <= targetMinutes) {
        continue; // ainda não chegou a hora hoje — o caso mais comum, não vale logar
      }

      const minutesLate = nowMinutes - targetMinutes;
      const existing = await this.logs.findScheduledFor(schedule.id, localDate);
      if (existing?.status.isSent) {
        this.explain(schedule.id, 'ja-enviado-hoje', {
          localDate,
          minutesLate,
          // Qual log bloqueou: sem isso, "já enviado" é uma afirmação que não dá para conferir.
          logId: existing.id,
          logStatus: existing.status.value,
          logTrigger: existing.trigger,
        });
        continue;
      }

      if (minutesLate <= command.catchUpWindowHours * 60) {
        due.push({
          scheduleId: schedule.id,
          userId: schedule.userId,
          referenceDate: localDate,
          reason: 'catch-up',
          // Reaproveita o log do dia (normalmente um `failed`) em vez de tentar criar outro.
          existingLogId: existing?.id,
        });
        continue;
      }

      this.explain(schedule.id, 'fora-da-janela-de-recuperacao', {
        localDate,
        minutesLate,
        janelaHoras: command.catchUpWindowHours,
      });

      // Fora da janela: registra `skipped` uma única vez, para o histórico explicar o dia vazio.
      if (!existing) {
        const created = await this.logs.createPending(
          DispatchLog.createPending({
            userId: schedule.userId,
            scheduleId: schedule.id,
            referenceDate: localDate,
            trigger: 'scheduled',
          }),
        );
        if (created) {
          created.markSkipped(
            `Fora da janela de recuperação de ${command.catchUpWindowHours}h após ${schedule.sendTime.value}`,
          );
          await this.logs.save(created);
          this.logger.warn('Envio do dia marcado como skipped', {
            scheduleId: schedule.id,
            referenceDate: localDate,
            minutesLate,
          });
        }
      }
    }

    return due;
  }

  /**
   * Por que um agendamento ativo NÃO foi enviado.
   *
   * O batimento mostra que o tick rodou e o que ele viu; isto mostra o que ele DECIDIU. Sem os
   * dois, um agendamento ativo, atrasado e dentro da janela que simplesmente não entra na fila
   * obriga a deduzir a causa lendo o código — foi o que aconteceu, e custou caro.
   *
   * Só descartes silenciosos são registrados. "Ainda não chegou a hora" fica fora: é o caso da
   * imensa maioria dos ticks e afogaria o log.
   */
  private explain(scheduleId: string, motivo: string, detalhes: Record<string, unknown>): void {
    this.logger.warn('Agendamento não enviado', { scheduleId, motivo, ...detalhes });
  }

  /**
   * Prova de vida do agendador. Sai no PRIMEIRO tick — logo após o boot, sem esperar 15 minutos —
   * e depois a cada 15. Mostra a hora local de cada agendamento ativo ao lado do horário
   * configurado: é a comparação exata que o tick faz, então um erro de fuso fica visível sem
   * precisar de nenhuma outra investigação.
   */
  private heartbeat(now: Date, active: Schedule[]): void {
    this.tickCount += 1;
    const first = this.tickCount === 1;
    if (!first && this.tickCount % PlanDispatchTickUseCase.HEARTBEAT_EVERY_TICKS !== 0) {
      return;
    }

    this.logger.log('Agendador ativo', {
      tick: this.tickCount,
      agendamentosAtivos: active.length,
      // Sem dado sensível: id do agendamento, horário alvo e hora local vista pelo tick.
      agendamentos: active.map((s) => ({
        scheduleId: s.id,
        alvo: s.sendTime.value,
        agoraLocal: localTimeInTimeZone(now, s.timezone.value),
        fuso: s.timezone.value,
      })),
    });
  }
}
