import {
  addDays,
  diffInDays,
  formatPlanDate,
  MONTHS_PT_BR,
  resolveDayNumber,
} from '../../../src/contexts/catalog/domain/services/plan-date';

describe('formatPlanDate', () => {
  it('formata os 12 meses em pt-BR maiúsculo, sem depender de locale do SO', () => {
    const esperado = [
      '15 de JANEIRO',
      '15 de FEVEREIRO',
      '15 de MARÇO',
      '15 de ABRIL',
      '15 de MAIO',
      '15 de JUNHO',
      '15 de JULHO',
      '15 de AGOSTO',
      '15 de SETEMBRO',
      '15 de OUTUBRO',
      '15 de NOVEMBRO',
      '15 de DEZEMBRO',
    ];
    const obtido = MONTHS_PT_BR.map((_, i) =>
      formatPlanDate(`2026-${String(i + 1).padStart(2, '0')}-15`),
    );
    expect(obtido).toEqual(esperado);
  });

  it('mantém o acento de MARÇO', () => {
    expect(formatPlanDate('2026-03-03')).toBe('3 de MARÇO');
  });

  it('remove o zero à esquerda do dia', () => {
    expect(formatPlanDate('2026-01-01')).toBe('1 de JANEIRO');
    expect(formatPlanDate('2026-01-09')).toBe('9 de JANEIRO');
  });

  it('formata dia 31', () => {
    expect(formatPlanDate('2026-12-31')).toBe('31 de DEZEMBRO');
  });

  it('reproduz exatamente a linha 1 do exemplo da spec', () => {
    expect(formatPlanDate('2026-07-28')).toBe('28 de JULHO');
  });

  it.each(['28/07/2026', '2026-7-28', '', 'hoje', '2026-13-01'])(
    'rejeita data mal formada: %s',
    (valor) => {
      expect(() => formatPlanDate(valor)).toThrow(/Invalid ISO date/);
    },
  );
});

describe('diffInDays', () => {
  it('conta dias entre datas civis', () => {
    expect(diffInDays('2026-01-01', '2026-01-01')).toBe(0);
    expect(diffInDays('2026-01-01', '2026-01-02')).toBe(1);
    expect(diffInDays('2026-01-01', '2026-12-31')).toBe(364);
  });

  it('atravessa a virada de horário de verão sem perder nem ganhar dia', () => {
    // Fev/2026 em ano não bissexto tem 28 dias — e a aritmética é em UTC, sem DST.
    expect(diffInDays('2026-02-01', '2026-03-01')).toBe(28);
  });

  it('conta dias negativos para datas anteriores', () => {
    expect(diffInDays('2026-01-10', '2026-01-01')).toBe(-9);
  });
});

describe('resolveDayNumber', () => {
  const PLAN_START = '2026-01-01';

  it('a data de início é o dia 1', () => {
    expect(resolveDayNumber(PLAN_START, PLAN_START, 0)).toBe(1);
  });

  it.each([
    // Âncoras conferidas contra o histórico real do grupo (28/07/2026).
    ['2026-07-28', 209, 'Dia 209 - Isaías 29-31'],
    ['2026-08-06', 218, 'Dia 218 - Isaías 64-66'],
    ['2026-08-07', 219, 'Dia 218 - Jeremias 1-3 (o segundo "218")'],
    ['2026-10-02', 275, 'Dia 274 - Malaquias 1-4'],
    ['2026-10-03', 276, 'Dia 276 - Mateus 1-4'],
    ['2026-12-31', 365, 'Dia 365 - Apocalipse 20-22 (última leitura)'],
  ])('%s → posição %i (%s)', (data, posicao) => {
    expect(resolveDayNumber(data, PLAN_START, 0)).toBe(posicao);
  });

  it('aplica o day_offset', () => {
    expect(resolveDayNumber('2026-07-28', PLAN_START, 0)).toBe(209);
    expect(resolveDayNumber('2026-07-28', PLAN_START, -1)).toBe(208);
    expect(resolveDayNumber('2026-07-28', PLAN_START, 1)).toBe(210);
  });

  it('data anterior ao início do plano dá número ≤ 0', () => {
    expect(resolveDayNumber('2025-12-31', PLAN_START, 0)).toBe(0);
    expect(resolveDayNumber('2025-12-25', PLAN_START, 0)).toBeLessThan(0);
  });
});

describe('addDays', () => {
  it('avança e retrocede atravessando meses e anos', () => {
    expect(addDays('2026-07-28', 5)).toBe('2026-08-02');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('é o inverso de resolveDayNumber', () => {
    const planStart = '2026-01-01';
    const dayNumber = resolveDayNumber('2026-07-28', planStart, 0);
    expect(addDays(planStart, dayNumber - 1)).toBe('2026-07-28');
  });
});
