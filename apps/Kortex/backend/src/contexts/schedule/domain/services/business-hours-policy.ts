import { BusinessHour } from '../../../account/domain/entities/business-hour.entity';
import {
  OutsideBusinessHoursException,
  UnalignedReservationException,
} from '../exceptions/schedule.exceptions';

/**
 * Fuso da operação.
 *
 * As janelas de funcionamento são horários LOCAIS ("abre 07:00") e `starts_at` é `timestamptz`.
 * Para saber se um instante cai dentro de uma janela é preciso traduzi-lo para o relógio da
 * oficina — e o relógio do servidor não serve, porque em produção ele roda em UTC.
 *
 * **Limitação conhecida:** a conta não tem coluna de fuso (a spec não a define) e o valor vem do
 * ambiente. Vale enquanto todas as contas estiverem no mesmo fuso, que é o caso hoje. Uma conta
 * em outro fuso exige uma coluna `account.timezone` — decisão para quando aparecer, não antes.
 */
export const OPERATION_TIMEZONE = process.env.DEFAULT_TIMEZONE ?? 'America/Sao_Paulo';

interface LocalMoment {
  weekday: number;
  minutesFromMidnight: number;
  seconds: number;
}

/**
 * Traduz um instante para o relógio local da operação.
 *
 * Usa `Intl.DateTimeFormat`, e não aritmética de offset, porque offset fixo erra no dia em que o
 * país mexe no horário de verão — e erraria calado, deslocando a agenda inteira em uma hora.
 */
function toLocal(instant: Date): LocalMoment {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATION_TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant);

  const get = (type: string): string => parts.find((part) => part.type === type)?.value ?? '0';
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  // `hour12: false` devolve 24 para a meia-noite em alguns runtimes; 24:00 é 00:00.
  const hour = Number(get('hour')) % 24;

  return {
    weekday: weekdays[get('weekday')] ?? 0,
    minutesFromMidnight: hour * 60 + Number(get('minute')),
    seconds: Number(get('second')),
  };
}

/**
 * As regras de `machine_hour` da §4.8, num lugar só.
 *
 * Elas parecem três checagens independentes e são uma coisa só: **a hora de máquina é vendida em
 * hora cheia, dentro de uma única janela**. É por isso que a reserva das 11h às 14h com almoço das
 * 11h30 às 13h é recusada em vez de partida em duas — a spec é explícita, e partir a reserva
 * significaria cobrar duas vezes o mesmo corte ou perder o intervalo do almoço.
 */
export class BusinessHoursPolicy {
  /**
   * Início alinhado em hora cheia e duração inteira em horas (decisão 2.2).
   *
   * Devolve as horas — é o número que a reserva vende e que multiplica o preço.
   */
  static assertWholeHours(startsAt: Date, endsAt: Date): number {
    const local = toLocal(startsAt);

    if (
      local.minutesFromMidnight % 60 !== 0 ||
      local.seconds !== 0 ||
      startsAt.getMilliseconds() !== 0
    ) {
      throw new UnalignedReservationException(
        'A hora de máquina começa em hora cheia (ex.: 07:00, 08:00).',
      );
    }

    const durationMs = endsAt.getTime() - startsAt.getTime();
    if (durationMs <= 0) {
      throw new UnalignedReservationException('O fim da reserva deve ser depois do início.');
    }

    const hours = durationMs / 3_600_000;
    if (!Number.isInteger(hours)) {
      throw new UnalignedReservationException(
        'A hora de máquina é vendida em horas inteiras — não há fração.',
      );
    }

    return hours;
  }

  /**
   * O intervalo inteiro cabe dentro de UMA janela do dia (§4.1.1).
   *
   * "Uma" é a palavra que importa: somar janelas para acomodar uma reserva que atravessa o almoço
   * seria justamente o que a spec proíbe.
   */
  static assertWithinSingleWindow(startsAt: Date, endsAt: Date, windows: BusinessHour[]): void {
    const start = toLocal(startsAt);
    // O fim é exclusivo: uma reserva que termina às 11:30 cabe na janela que fecha às 11:30.
    const end = toLocal(new Date(endsAt.getTime() - 1));

    if (start.weekday !== end.weekday) {
      throw new OutsideBusinessHoursException('A reserva não pode atravessar a virada do dia.');
    }

    const endMinutes = start.minutesFromMidnight + (endsAt.getTime() - startsAt.getTime()) / 60_000;
    const sameDay = windows.filter((window) => window.weekday === start.weekday);

    if (sameDay.length === 0) {
      throw new OutsideBusinessHoursException('A operação não abre neste dia da semana.');
    }

    const fits = sameDay.some(
      (window) =>
        start.minutesFromMidnight >= window.startsAt.minutes && endMinutes <= window.endsAt.minutes,
    );

    if (!fits) {
      const disponiveis = sameDay
        .map((window) => window.label)
        .sort()
        .join(' · ');
      throw new OutsideBusinessHoursException(
        `A reserva precisa caber inteira em uma única janela de funcionamento (${disponiveis}). ` +
          'Reserva que atravessa o intervalo não é aceita partida em duas.',
      );
    }
  }
}
