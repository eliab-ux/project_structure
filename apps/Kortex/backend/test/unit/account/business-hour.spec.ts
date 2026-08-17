import { BusinessHour } from '../../../src/contexts/account/domain/entities/business-hour.entity';
import { AccountId } from '../../../src/contexts/account/domain/value-objects/account-id.vo';
import { TimeOfDay } from '../../../src/shared/domain/value-objects/time-of-day.vo';
import { InvalidValueException } from '../../../src/shared/domain/exceptions/invalid-value.exception';
import { OverlappingBusinessHourException } from '../../../src/contexts/account/domain/exceptions/overlapping-business-hour.exception';

const accountId = AccountId.create();

function window(weekday: number, startsAt: string, endsAt: string): BusinessHour {
  return BusinessHour.create({
    accountId,
    weekday,
    startsAt: TimeOfDay.create(startsAt),
    endsAt: TimeOfDay.create(endsAt),
  });
}

describe('BusinessHour', () => {
  it('recusa dia da semana fora de 0..6', () => {
    expect(() => window(7, '07:00', '11:30')).toThrow(InvalidValueException);
    expect(() => window(-1, '07:00', '11:30')).toThrow(InvalidValueException);
  });

  it('recusa janela que termina antes de começar', () => {
    expect(() => window(1, '17:00', '09:00')).toThrow(InvalidValueException);
  });

  it('recusa janela de duração zero', () => {
    expect(() => window(1, '07:00', '07:00')).toThrow(InvalidValueException);
  });

  it('calcula a duração — é a base das "horas úteis do dia"', () => {
    expect(window(1, '07:00', '11:30').durationMinutes).toBe(270);
  });

  describe('sobreposição', () => {
    const manha = window(1, '07:00', '11:30');
    const tarde = window(1, '13:00', '17:30');

    it('aceita manhã e tarde no mesmo dia — o almoço é a ausência de janela', () => {
      expect(() => BusinessHour.assertNoOverlap([manha], tarde)).not.toThrow();
    });

    it('aceita janela que ENCOSTA na anterior (11:30 fecha uma e abre a outra)', () => {
      const almocoTrabalhado = window(1, '11:30', '13:00');
      expect(() => BusinessHour.assertNoOverlap([manha, tarde], almocoTrabalhado)).not.toThrow();
    });

    it('recusa janela que cruza uma existente', () => {
      expect(() =>
        BusinessHour.assertNoOverlap([manha, tarde], window(1, '10:00', '12:00')),
      ).toThrow(OverlappingBusinessHourException);
    });

    it('recusa janela contida em outra', () => {
      expect(() => BusinessHour.assertNoOverlap([manha], window(1, '08:00', '09:00'))).toThrow(
        OverlappingBusinessHourException,
      );
    });

    it('recusa janela que engloba outra', () => {
      expect(() => BusinessHour.assertNoOverlap([manha], window(1, '06:00', '12:00'))).toThrow(
        OverlappingBusinessHourException,
      );
    });

    it('aceita a mesma faixa em outro dia da semana', () => {
      expect(() =>
        BusinessHour.assertNoOverlap([manha], window(2, '07:00', '11:30')),
      ).not.toThrow();
    });

    it('nomeia a janela conflitante na mensagem — é isso que o erro do banco não faz', () => {
      expect(() => BusinessHour.assertNoOverlap([manha], window(1, '10:00', '12:00'))).toThrow(
        /07:00–11:30/,
      );
    });
  });
});
