import { BusinessHoursPolicy } from '../../../src/contexts/schedule/domain/services/business-hours-policy';
import { BusinessHour } from '../../../src/contexts/account/domain/entities/business-hour.entity';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { TimeOfDay } from '../../../src/shared/domain/value-objects/time-of-day.vo';
import {
  OutsideBusinessHoursException,
  UnalignedReservationException,
} from '../../../src/contexts/schedule/domain/exceptions/schedule.exceptions';

const accountId = AccountId.create();

/** Segunda-feira. Manhã 07:00–11:30, tarde 13:00–17:30 — o exemplo da própria spec. */
function segunda(startsAt: string, endsAt: string): BusinessHour {
  return BusinessHour.create({
    accountId,
    weekday: 1,
    startsAt: TimeOfDay.create(startsAt),
    endsAt: TimeOfDay.create(endsAt),
  });
}

const JANELAS = [segunda('07:00', '11:30'), segunda('13:00', '17:30')];

/** 2026-09-07 é uma segunda-feira. Horário de Brasília = UTC-3. */
function local(hhmm: string): Date {
  return new Date(`2026-09-07T${hhmm}:00.000-03:00`);
}

describe('BusinessHoursPolicy — hora cheia', () => {
  it('aceita início em hora cheia com duração inteira', () => {
    expect(BusinessHoursPolicy.assertWholeHours(local('07:00'), local('10:00'))).toBe(3);
    expect(BusinessHoursPolicy.assertWholeHours(local('13:00'), local('14:00'))).toBe(1);
  });

  it('recusa início com minuto diferente de zero', () => {
    expect(() => BusinessHoursPolicy.assertWholeHours(local('07:30'), local('09:30'))).toThrow(
      UnalignedReservationException,
    );
  });

  it('recusa duração fracionada', () => {
    expect(() => BusinessHoursPolicy.assertWholeHours(local('07:00'), local('08:30'))).toThrow(
      UnalignedReservationException,
    );
  });

  it('recusa duração zero ou negativa', () => {
    expect(() => BusinessHoursPolicy.assertWholeHours(local('07:00'), local('07:00'))).toThrow(
      UnalignedReservationException,
    );
    expect(() => BusinessHoursPolicy.assertWholeHours(local('09:00'), local('08:00'))).toThrow(
      UnalignedReservationException,
    );
  });
});

describe('BusinessHoursPolicy — janela de funcionamento', () => {
  it('aceita reserva inteira dentro da janela da manhã', () => {
    expect(() =>
      BusinessHoursPolicy.assertWithinSingleWindow(local('07:00'), local('11:00'), JANELAS),
    ).not.toThrow();
  });

  it('aceita reserva que termina EXATAMENTE no fim da janela', () => {
    // 08:00–11:30 termina no minuto em que a janela fecha; o fim é exclusivo.
    expect(() =>
      BusinessHoursPolicy.assertWithinSingleWindow(
        local('08:00'),
        new Date(`2026-09-07T11:30:00.000-03:00`),
        JANELAS,
      ),
    ).not.toThrow();
  });

  it('RECUSA reserva que atravessa o intervalo do almoço — o caso da spec (11h→14h)', () => {
    expect(() =>
      BusinessHoursPolicy.assertWithinSingleWindow(local('11:00'), local('14:00'), JANELAS),
    ).toThrow(OutsideBusinessHoursException);
  });

  it('a mensagem explica que a reserva não é partida em duas', () => {
    expect(() =>
      BusinessHoursPolicy.assertWithinSingleWindow(local('11:00'), local('14:00'), JANELAS),
    ).toThrow(/partida em duas/);
  });

  it('recusa reserva antes da abertura', () => {
    expect(() =>
      BusinessHoursPolicy.assertWithinSingleWindow(local('06:00'), local('08:00'), JANELAS),
    ).toThrow(OutsideBusinessHoursException);
  });

  it('recusa reserva depois do fechamento', () => {
    expect(() =>
      BusinessHoursPolicy.assertWithinSingleWindow(local('17:00'), local('19:00'), JANELAS),
    ).toThrow(OutsideBusinessHoursException);
  });

  it('recusa reserva em dia sem janela nenhuma', () => {
    // 2026-09-06 é domingo.
    const domingo = (hhmm: string) => new Date(`2026-09-06T${hhmm}:00.000-03:00`);
    expect(() =>
      BusinessHoursPolicy.assertWithinSingleWindow(domingo('08:00'), domingo('10:00'), JANELAS),
    ).toThrow(/não abre neste dia/);
  });

  it('recusa reserva que atravessa a virada do dia', () => {
    expect(() =>
      BusinessHoursPolicy.assertWithinSingleWindow(
        local('23:00'),
        new Date(`2026-09-08T01:00:00.000-03:00`),
        JANELAS,
      ),
    ).toThrow(OutsideBusinessHoursException);
  });

  it('usa o relógio LOCAL, não o do servidor', () => {
    // 10:00 UTC = 07:00 em Brasília: dentro da janela da manhã.
    expect(() =>
      BusinessHoursPolicy.assertWithinSingleWindow(
        new Date('2026-09-07T10:00:00.000Z'),
        new Date('2026-09-07T13:00:00.000Z'),
        JANELAS,
      ),
    ).not.toThrow();

    // 07:00 UTC = 04:00 em Brasília: fora.
    expect(() =>
      BusinessHoursPolicy.assertWithinSingleWindow(
        new Date('2026-09-07T07:00:00.000Z'),
        new Date('2026-09-07T09:00:00.000Z'),
        JANELAS,
      ),
    ).toThrow(OutsideBusinessHoursException);
  });
});
