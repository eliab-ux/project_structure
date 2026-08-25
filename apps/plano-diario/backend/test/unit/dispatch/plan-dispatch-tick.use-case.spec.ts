import { DispatchLogRepositoryPort } from '../../../src/contexts/dispatch/application/ports/output/dispatch-log-repository.port';
import { DispatchLog } from '../../../src/contexts/dispatch/domain/entities/dispatch-log.entity';
import { PlanDispatchTickUseCase } from '../../../src/contexts/dispatch/application/use-cases/plan-dispatch-tick/plan-dispatch-tick.use-case';
import { ScheduleRepositoryPort } from '../../../src/contexts/schedule/application/ports/output/schedule-repository.port';
import { Schedule } from '../../../src/contexts/schedule/domain/entities/schedule.entity';
import { MessageTemplate } from '../../../src/contexts/schedule/domain/value-objects/message-template.vo';
import { SendTime } from '../../../src/contexts/schedule/domain/value-objects/send-time.vo';
import { Timezone } from '../../../src/contexts/schedule/domain/value-objects/timezone.vo';

function agendamento(params: { sendTime: string; timezone: string; isActive?: boolean }): Schedule {
  const s = Schedule.create({
    userId: 'd3637abe-5b58-4e5d-b838-d23317aaad18',
    groupJid: '120363021234567890@g.us',
    groupName: 'Grupo',
    sendTime: SendTime.create(params.sendTime),
    timezone: Timezone.create(params.timezone),
    planStartDate: '2026-01-01',
    messageTemplate: MessageTemplate.create(),
  });
  if (params.isActive === false) {
    s.setActive(false);
  }
  return s;
}

/** 28/07/2026 às 10:00 UTC = 07:00 em São Paulo (UTC-3). */
const UTC_10 = new Date('2026-07-28T10:00:00Z');

describe('PlanDispatchTickUseCase', () => {
  let schedules: jest.Mocked<ScheduleRepositoryPort>;
  let logs: jest.Mocked<DispatchLogRepositoryPort>;
  let useCase: PlanDispatchTickUseCase;

  beforeEach(() => {
    schedules = {
      save: jest.fn(),
      findByUserId: jest.fn(),
      findById: jest.fn(),
      findAllActive: jest.fn().mockResolvedValue([]),
    };
    logs = {
      createPending: jest.fn((log) => Promise.resolve(log)),
      save: jest.fn((log) => Promise.resolve(log)),
      findById: jest.fn(),
      findScheduledFor: jest.fn().mockResolvedValue(null),
      countManualSince: jest.fn(),
      listByUser: jest.fn(),
    };
    useCase = new PlanDispatchTickUseCase(schedules, logs);
  });

  it('dispara no minuto exato, na data LOCAL do usuário', async () => {
    schedules.findAllActive.mockResolvedValue([
      agendamento({ sendTime: '07:00', timezone: 'America/Sao_Paulo' }),
    ]);

    const due = await useCase.execute({ now: UTC_10, catchUpWindowHours: 3 });

    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ reason: 'on-time', referenceDate: '2026-07-28' });
  });

  it('o mesmo instante NÃO dispara para outro fuso', async () => {
    // 10:00 UTC é 07:00 em SP mas 11:00 em Lisboa — o de Lisboa não é agora.
    schedules.findAllActive.mockResolvedValue([
      agendamento({ sendTime: '07:00', timezone: 'Europe/Lisbon' }),
    ]);

    const due = await useCase.execute({ now: UTC_10, catchUpWindowHours: 3 });

    // 11:00 > 07:00 → cai em catch-up, dentro da janela de 3h? 4h de atraso → fora.
    expect(due).toHaveLength(0);
  });

  it('antes do horário não dispara nada', async () => {
    schedules.findAllActive.mockResolvedValue([
      agendamento({ sendTime: '20:00', timezone: 'America/Sao_Paulo' }),
    ]);

    expect(await useCase.execute({ now: UTC_10, catchUpWindowHours: 3 })).toHaveLength(0);
  });

  it('CATCH-UP: horário passou, dentro da janela, sem envio → dispara', async () => {
    // 07:00 local; agora são 09:00 local (2h de atraso), janela de 3h.
    schedules.findAllActive.mockResolvedValue([
      agendamento({ sendTime: '07:00', timezone: 'America/Sao_Paulo' }),
    ]);

    const due = await useCase.execute({
      now: new Date('2026-07-28T12:00:00Z'),
      catchUpWindowHours: 3,
    });

    expect(due[0]).toMatchObject({ reason: 'catch-up' });
  });

  it('CATCH-UP recupera um dia que FALHOU, reaproveitando o log existente', async () => {
    // Cenário real: às 20:23 o envio falhou (catálogo vazio). Depois de resolver a causa, o
    // catch-up tem que reenviar — e para isso precisa reusar o log, porque a unique parcial do
    // banco recusaria um segundo log `scheduled` para o mesmo dia.
    schedules.findAllActive.mockResolvedValue([
      agendamento({ sendTime: '07:00', timezone: 'America/Sao_Paulo' }),
    ]);
    const falhado = DispatchLog.createPending({
      userId: 'd3637abe-5b58-4e5d-b838-d23317aaad18',
      scheduleId: 'schedule-1',
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });
    falhado.markFailed('Vídeo do dia 209 não encontrado no catálogo');
    logs.findScheduledFor.mockResolvedValue(falhado);

    const due = await useCase.execute({
      now: new Date('2026-07-28T12:00:00Z'),
      catchUpWindowHours: 3,
    });

    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ reason: 'catch-up', existingLogId: falhado.id });
  });

  it('não redispara quando o dia JÁ FOI enviado', async () => {
    schedules.findAllActive.mockResolvedValue([
      agendamento({ sendTime: '07:00', timezone: 'America/Sao_Paulo' }),
    ]);
    const enviado = DispatchLog.createPending({
      userId: 'd3637abe-5b58-4e5d-b838-d23317aaad18',
      scheduleId: 'schedule-1',
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });
    enviado.markSent('28 de JULHO\nhttps://youtu.be/Mr_WsXKXN30');
    logs.findScheduledFor.mockResolvedValue(enviado);

    // Vale tanto no minuto exato quanto na janela de catch-up.
    expect(await useCase.execute({ now: UTC_10, catchUpWindowHours: 3 })).toHaveLength(0);
    expect(
      await useCase.execute({ now: new Date('2026-07-28T12:00:00Z'), catchUpWindowHours: 3 }),
    ).toHaveLength(0);
  });

  it('FORA da janela: marca skipped e não envia', async () => {
    // 07:00 local, agora 18:00 local (11h de atraso) — mandar a leitura às 18h não faz sentido.
    schedules.findAllActive.mockResolvedValue([
      agendamento({ sendTime: '07:00', timezone: 'America/Sao_Paulo' }),
    ]);

    const due = await useCase.execute({
      now: new Date('2026-07-28T21:00:00Z'),
      catchUpWindowHours: 3,
    });

    expect(due).toHaveLength(0);
    const salvo = logs.save.mock.calls[0][0];
    expect(salvo.status.value).toBe('skipped');
    expect(salvo.errorReason).toContain('Fora da janela');
  });

  it('não marca skipped duas vezes para o mesmo dia', async () => {
    schedules.findAllActive.mockResolvedValue([
      agendamento({ sendTime: '07:00', timezone: 'America/Sao_Paulo' }),
    ]);
    const jaMarcado = DispatchLog.createPending({
      userId: 'd3637abe-5b58-4e5d-b838-d23317aaad18',
      scheduleId: 'schedule-1',
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });
    jaMarcado.markSkipped('Fora da janela');
    logs.findScheduledFor.mockResolvedValue(jaMarcado);

    await useCase.execute({ now: new Date('2026-07-28T21:00:00Z'), catchUpWindowHours: 3 });

    expect(logs.createPending).not.toHaveBeenCalled();
  });

  it('agendamento pausado é ignorado (findAllActive não o devolve)', async () => {
    schedules.findAllActive.mockResolvedValue([]);
    expect(await useCase.execute({ now: UTC_10, catchUpWindowHours: 3 })).toHaveLength(0);
  });

  it('vários usuários em fusos diferentes são avaliados independentemente', async () => {
    schedules.findAllActive.mockResolvedValue([
      agendamento({ sendTime: '07:00', timezone: 'America/Sao_Paulo' }),
      agendamento({ sendTime: '10:00', timezone: 'UTC' }),
      agendamento({ sendTime: '23:00', timezone: 'America/Sao_Paulo' }),
    ]);

    const due = await useCase.execute({ now: UTC_10, catchUpWindowHours: 3 });

    // Os dois primeiros são "agora"; o terceiro ainda não chegou.
    expect(due).toHaveLength(2);
    expect(due.every((d) => d.reason === 'on-time')).toBe(true);
  });
});
