import { DispatchLogRepositoryPort } from '../../../src/contexts/dispatch/application/ports/output/dispatch-log-repository.port';
import { ExecuteDispatchUseCase } from '../../../src/contexts/dispatch/application/use-cases/execute-dispatch/execute-dispatch.use-case';
import { VideoThumbnailPort } from '../../../src/contexts/catalog/application/ports/output/video-thumbnail.port';
import { ResolveVideoForDateUseCase } from '../../../src/contexts/catalog/application/use-cases/resolve-video-for-date/resolve-video-for-date.use-case';
import { ScheduleRepositoryPort } from '../../../src/contexts/schedule/application/ports/output/schedule-repository.port';
import { Schedule } from '../../../src/contexts/schedule/domain/entities/schedule.entity';
import { MessageTemplate } from '../../../src/contexts/schedule/domain/value-objects/message-template.vo';
import { SendTime } from '../../../src/contexts/schedule/domain/value-objects/send-time.vo';
import { Timezone } from '../../../src/contexts/schedule/domain/value-objects/timezone.vo';
import { WhatsappGatewayPort } from '../../../src/contexts/whatsapp/application/ports/output/whatsapp-gateway.port';
import { WhatsappInstanceRepositoryPort } from '../../../src/contexts/whatsapp/application/ports/output/whatsapp-instance-repository.port';
import { WhatsappInstance } from '../../../src/contexts/whatsapp/domain/entities/whatsapp-instance.entity';
import { ConnectionStatus } from '../../../src/contexts/whatsapp/domain/value-objects/connection-status.vo';
import { InstanceName } from '../../../src/contexts/whatsapp/domain/value-objects/instance-name.vo';
import { DispatchLog } from '../../../src/contexts/dispatch/domain/entities/dispatch-log.entity';

const USER_ID = 'd3637abe-5b58-4e5d-b838-d23317aaad18';
const JID = '120363021234567890@g.us';

function agendamento(): Schedule {
  return Schedule.create({
    userId: USER_ID,
    groupJid: JID,
    groupName: 'Plano de Leitura',
    sendTime: SendTime.create('07:00'),
    timezone: Timezone.create('America/Sao_Paulo'),
    planStartDate: '2026-01-01',
    messageTemplate: MessageTemplate.create(),
  });
}

function instancia(status = ConnectionStatus.CONNECTED): WhatsappInstance {
  const i = WhatsappInstance.create({
    userId: USER_ID,
    instanceName: InstanceName.forUser(USER_ID),
    token: 'token-instancia',
  });
  i.syncStatus(status, status.isConnected ? '5511999999999' : null);
  i.pullDomainEvents();
  return i;
}

describe('ExecuteDispatchUseCase', () => {
  let logs: jest.Mocked<DispatchLogRepositoryPort>;
  let schedules: jest.Mocked<ScheduleRepositoryPort>;
  let instances: jest.Mocked<WhatsappInstanceRepositoryPort>;
  let gateway: jest.Mocked<WhatsappGatewayPort>;
  let thumbnails: jest.Mocked<VideoThumbnailPort>;
  let resolveVideo: jest.Mocked<ResolveVideoForDateUseCase>;
  let useCase: ExecuteDispatchUseCase;
  let schedule: Schedule;

  /** Nada foi postado no grupo — por imagem nem por texto. */
  function nadaEnviado(): boolean {
    return (
      gateway.sendText.mock.calls.length === 0 &&
      gateway.sendImageWithCaption.mock.calls.length === 0
    );
  }

  beforeEach(() => {
    schedule = agendamento();
    logs = {
      createPending: jest.fn((log) => Promise.resolve(log)),
      save: jest.fn((log) => Promise.resolve(log)),
      findById: jest.fn(),
      findScheduledFor: jest.fn().mockResolvedValue(null),
      countManualSince: jest.fn().mockResolvedValue(0),
      listByUser: jest.fn(),
    };
    schedules = {
      save: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue(schedule),
      findById: jest.fn().mockResolvedValue(schedule),
      findAllActive: jest.fn(),
    };
    instances = {
      save: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue(instancia()),
      findByInstanceName: jest.fn(),
      delete: jest.fn(),
    };
    gateway = {
      createInstance: jest.fn(),
      connect: jest.fn(),
      getConnectionState: jest.fn(),
      listGroups: jest.fn(),
      sendText: jest.fn().mockResolvedValue({ providerMessageId: 'msg-1' }),
      sendImageWithCaption: jest.fn().mockResolvedValue({ providerMessageId: 'msg-img-1' }),
      logout: jest.fn(),
      deleteInstance: jest.fn(),
    };
    thumbnails = {
      fetch: jest.fn().mockResolvedValue({ base64: 'AAAAbase64AAAA', mimeType: 'image/jpeg' }),
    };
    resolveVideo = {
      execute: jest.fn().mockResolvedValue({
        dayNumber: 207,
        title: 'Dia 209 - Isaías 29-31',
        videoId: 'Mr_WsXKXN30',
        url: 'https://youtu.be/Mr_WsXKXN30',
        formattedDate: '28 de JULHO',
        referenceDate: '2026-07-28',
      }),
    } as unknown as jest.Mocked<ResolveVideoForDateUseCase>;

    useCase = new ExecuteDispatchUseCase(
      logs,
      schedules,
      instances,
      gateway,
      thumbnails,
      resolveVideo,
    );
  });

  it('envia a miniatura do vídeo com as duas linhas de legenda', async () => {
    const result = await useCase.execute({
      scheduleId: schedule.id,
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });

    expect(result.status).toBe('sent');
    expect(thumbnails.fetch).toHaveBeenCalledWith('Mr_WsXKXN30');
    const [, , jid, image] = gateway.sendImageWithCaption.mock.calls[0];
    expect(jid).toBe(JID);
    // A legenda é EXATAMENTE a mensagem de duas linhas — a imagem não acrescenta texto nenhum.
    expect(image.caption).toBe('28 de JULHO\nhttps://youtu.be/Mr_WsXKXN30');
    expect(image.mimeType).toBe('image/jpeg');
    expect(gateway.sendText).not.toHaveBeenCalled();
    // O histórico guarda o texto, não a imagem.
    expect(result.message).toBe('28 de JULHO\nhttps://youtu.be/Mr_WsXKXN30');
  });

  it('sem miniatura, a leitura AINDA vai — como texto', async () => {
    thumbnails.fetch.mockResolvedValue(null);

    const result = await useCase.execute({
      scheduleId: schedule.id,
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });

    expect(result.status).toBe('sent');
    const [, , , text] = gateway.sendText.mock.calls[0];
    expect(text).toBe('28 de JULHO\nhttps://youtu.be/Mr_WsXKXN30');
    expect(gateway.sendImageWithCaption).not.toHaveBeenCalled();
  });

  it('falha no envio da imagem NÃO tenta o texto depois (evitaria envio duplicado)', async () => {
    gateway.sendImageWithCaption.mockRejectedValue(new Error('provider fora do ar'));

    const result = await useCase.execute({
      scheduleId: schedule.id,
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });

    expect(result.status).toBe('failed');
    expect(gateway.sendText).not.toHaveBeenCalled();
  });

  it('IDEMPOTÊNCIA: log recusado pelo banco → não envia nada', async () => {
    logs.createPending.mockResolvedValue(null);

    const result = await useCase.execute({
      scheduleId: schedule.id,
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });

    expect(result.status).toBe('duplicate');
    expect(nadaEnviado()).toBe(true);
  });

  it('cria o log ANTES de qualquer outra coisa (é o que garante 1 envio/dia)', async () => {
    const ordem: string[] = [];
    logs.createPending.mockImplementation((log) => {
      ordem.push('createPending');
      return Promise.resolve(log);
    });
    instances.findByUserId.mockImplementation(() => {
      ordem.push('findInstance');
      return Promise.resolve(instancia());
    });
    thumbnails.fetch.mockImplementation(() => {
      ordem.push('thumbnail');
      return Promise.resolve({ base64: 'x', mimeType: 'image/jpeg' });
    });
    gateway.sendImageWithCaption.mockImplementation(() => {
      ordem.push('send');
      return Promise.resolve({ providerMessageId: 'x' });
    });

    await useCase.execute({
      scheduleId: schedule.id,
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });

    // A miniatura é buscada antes do envio: se falhar, ainda dá tempo de cair para texto.
    expect(ordem).toEqual(['createPending', 'findInstance', 'thumbnail', 'send']);
  });

  it('WhatsApp desconectado → failed, nada é enviado', async () => {
    instances.findByUserId.mockResolvedValue(instancia(ConnectionStatus.DISCONNECTED));

    const result = await useCase.execute({
      scheduleId: schedule.id,
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });

    expect(result.status).toBe('failed');
    expect(result.reason).toContain('WhatsApp não conectado');
    expect(nadaEnviado()).toBe(true);
  });

  it('vídeo do dia não encontrado → failed, e NENHUM fallback é enviado', async () => {
    resolveVideo.execute.mockRejectedValue(
      new Error('Vídeo do dia 300 não encontrado no catálogo'),
    );

    const result = await useCase.execute({
      scheduleId: schedule.id,
      referenceDate: '2026-10-03',
      trigger: 'scheduled',
    });

    expect(result.status).toBe('failed');
    expect(nadaEnviado()).toBe(true);
    // Nem a miniatura é buscada: sem vídeo resolvido não existe imagem para buscar.
    expect(thumbnails.fetch).not.toHaveBeenCalled();
    const salvo = logs.save.mock.calls.at(-1)?.[0] as DispatchLog;
    expect(salvo.status.value).toBe('failed');
    expect(salvo.messageSent).toBeNull();
  });

  it('falha no envio marca failed e conta a tentativa', async () => {
    gateway.sendImageWithCaption.mockRejectedValue(new Error('provider fora do ar'));

    const result = await useCase.execute({
      scheduleId: schedule.id,
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });

    expect(result.status).toBe('failed');
    const salvo = logs.save.mock.calls.at(-1)?.[0] as DispatchLog;
    expect(salvo.attempts).toBe(1);
  });

  it('retry reaproveita o MESMO log em vez de criar outro', async () => {
    const existente = DispatchLog.createPending({
      userId: USER_ID,
      scheduleId: schedule.id,
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });
    logs.findById.mockResolvedValue(existente);

    await useCase.execute({
      scheduleId: schedule.id,
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
      existingLogId: existente.id,
    });

    expect(logs.createPending).not.toHaveBeenCalled();
    expect(logs.findById).toHaveBeenCalledWith(existente.id);
  });

  it('o motivo do erro é sanitizado (sem token/apikey no histórico)', async () => {
    const FAKE_APIKEY = 'FAKEapikeyFicticiaParaTeste12345';
    gateway.sendImageWithCaption.mockRejectedValue(
      new Error(`401 apikey=${FAKE_APIKEY} inválida`),
    );

    const result = await useCase.execute({
      scheduleId: schedule.id,
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });

    expect(result.reason).not.toContain(FAKE_APIKEY);
    expect(result.reason).toContain('***');
  });

  it('agendamento inexistente não cria log', async () => {
    schedules.findById.mockResolvedValue(null);

    const result = await useCase.execute({
      scheduleId: 'nao-existe',
      referenceDate: '2026-07-28',
      trigger: 'scheduled',
    });

    expect(result.status).toBe('failed');
    expect(logs.createPending).not.toHaveBeenCalled();
  });
});
