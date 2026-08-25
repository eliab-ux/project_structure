import { GroupDirectoryPort } from '../../../src/contexts/schedule/application/ports/output/group-directory.port';
import { ScheduleRepositoryPort } from '../../../src/contexts/schedule/application/ports/output/schedule-repository.port';
import { UpsertScheduleUseCase } from '../../../src/contexts/schedule/application/use-cases/upsert-schedule/upsert-schedule.use-case';
import { GroupNotFoundException } from '../../../src/contexts/whatsapp/domain/exceptions/group-not-found.exception';

const USER_ID = 'd3637abe-5b58-4e5d-b838-d23317aaad18';
const JID = '120363021234567890@g.us';

describe('UpsertScheduleUseCase', () => {
  let repository: jest.Mocked<ScheduleRepositoryPort>;
  let groups: jest.Mocked<GroupDirectoryPort>;
  let useCase: UpsertScheduleUseCase;

  beforeEach(() => {
    repository = {
      save: jest.fn((s) => Promise.resolve(s)),
      findByUserId: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      findAllActive: jest.fn(),
    };
    groups = {
      findByUserAndJid: jest.fn().mockResolvedValue({ jid: JID, name: 'Plano de Leitura' }),
    };
    useCase = new UpsertScheduleUseCase(repository, groups);
  });

  it('cria o agendamento com os defaults', async () => {
    const dto = await useCase.execute({
      userId: USER_ID,
      groupJid: JID,
      sendTime: '07:00',
      planStartDate: '2026-01-01',
    });

    expect(dto.groupName).toBe('Plano de Leitura');
    expect(dto.timezone).toBe('America/Sao_Paulo');
    expect(dto.messageTemplate).toBe('{{date}}\n{{url}}');
    expect(dto.dayOffset).toBe(0);
    expect(dto.isActive).toBe(true);
  });

  it('RECUSA grupo que não é do usuário', async () => {
    // A barreira que impede configurar envio para um grupo arbitrário informado no body.
    groups.findByUserAndJid.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: USER_ID,
        groupJid: '120363029999999999@g.us',
        sendTime: '07:00',
        planStartDate: '2026-01-01',
      }),
    ).rejects.toThrow(GroupNotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('grava o nome do grupo vindo do cache, não o que o cliente mandar', async () => {
    groups.findByUserAndJid.mockResolvedValue({ jid: JID, name: 'Nome Real do Grupo' });

    const dto = await useCase.execute({
      userId: USER_ID,
      groupJid: JID,
      sendTime: '07:00',
      planStartDate: '2026-01-01',
    });

    expect(dto.groupName).toBe('Nome Real do Grupo');
  });

  it.each([
    ['horário', { sendTime: '25:00' }],
    ['fuso', { timezone: 'Marte/Olympus' }],
    ['template sem url', { messageTemplate: 'só a data {{date}}' }],
    ['data de início', { planStartDate: '03/01/2026' }],
  ])('recusa %s inválido', async (_caso, override) => {
    await expect(
      useCase.execute({
        userId: USER_ID,
        groupJid: JID,
        sendTime: '07:00',
        planStartDate: '2026-01-01',
        ...override,
      }),
    ).rejects.toThrow();
  });

  it('atualiza o agendamento existente em vez de criar outro', async () => {
    const existente = await useCase.execute({
      userId: USER_ID,
      groupJid: JID,
      sendTime: '07:00',
      planStartDate: '2026-01-01',
    });
    repository.findByUserId.mockResolvedValue(
      (repository.save.mock.calls[0][0] as never) satisfies never,
    );

    const atualizado = await useCase.execute({
      userId: USER_ID,
      groupJid: JID,
      sendTime: '20:30',
      planStartDate: '2026-01-01',
    });

    expect(atualizado.id).toBe(existente.id);
    expect(atualizado.sendTime).toBe('20:30');
  });
});
