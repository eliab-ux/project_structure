import { WhatsappGatewayPort } from '../../../src/contexts/whatsapp/application/ports/output/whatsapp-gateway.port';
import { WhatsappGroupRepositoryPort } from '../../../src/contexts/whatsapp/application/ports/output/whatsapp-group-repository.port';
import { WhatsappInstanceRepositoryPort } from '../../../src/contexts/whatsapp/application/ports/output/whatsapp-instance-repository.port';
import { ListGroupsUseCase } from '../../../src/contexts/whatsapp/application/use-cases/list-groups/list-groups.use-case';
import { SyncGroupsUseCase } from '../../../src/contexts/whatsapp/application/use-cases/sync-groups/sync-groups.use-case';
import {
  GROUP_CACHE_MAX_AGE_DAYS,
  WhatsappGroup,
} from '../../../src/contexts/whatsapp/domain/entities/whatsapp-group.entity';
import { WhatsappInstance } from '../../../src/contexts/whatsapp/domain/entities/whatsapp-instance.entity';
import { WhatsappInstanceNotFoundException } from '../../../src/contexts/whatsapp/domain/exceptions/whatsapp-instance-not-found.exception';
import { WhatsappNotConnectedException } from '../../../src/contexts/whatsapp/domain/exceptions/whatsapp-not-connected.exception';
import { ConnectionStatus } from '../../../src/contexts/whatsapp/domain/value-objects/connection-status.vo';
import { GroupJid } from '../../../src/contexts/whatsapp/domain/value-objects/group-jid.vo';
import { InstanceName } from '../../../src/contexts/whatsapp/domain/value-objects/instance-name.vo';

const USER_ID = 'd3637abe-5b58-4e5d-b838-d23317aaad18';
const JID_A = '120363021111111111@g.us';
const JID_B = '120363022222222222@g.us';

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

function grupoCache(jid: string, nome: string, syncedAt = new Date()): WhatsappGroup {
  return WhatsappGroup.reconstitute({
    id: `id-${jid}`,
    userId: USER_ID,
    instanceId: 'instance-1',
    jid: GroupJid.create(jid),
    name: nome,
    participantsCount: 10,
    syncedAt,
    createdAt: syncedAt,
    updatedAt: syncedAt,
  });
}

let instances: jest.Mocked<WhatsappInstanceRepositoryPort>;
let groups: jest.Mocked<WhatsappGroupRepositoryPort>;
let gateway: jest.Mocked<WhatsappGatewayPort>;
let syncUseCase: SyncGroupsUseCase;

beforeEach(() => {
  instances = {
    save: jest.fn(),
    findByUserId: jest.fn().mockResolvedValue(instancia()),
    findByInstanceName: jest.fn(),
    delete: jest.fn(),
  };
  groups = {
    findAllByUserId: jest.fn().mockResolvedValue([]),
    findByUserAndJid: jest.fn(),
    replaceAllForUser: jest.fn(),
  };
  gateway = {
    createInstance: jest.fn(),
    connect: jest.fn(),
    getConnectionState: jest.fn(),
    listGroups: jest.fn().mockResolvedValue([
      { jid: JID_A, name: 'Plano de Leitura 2026', participantsCount: 42 },
      { jid: JID_B, name: 'Família', participantsCount: 8 },
    ]),
    sendText: jest.fn(),
    sendImageWithCaption: jest.fn(),
    logout: jest.fn(),
    deleteInstance: jest.fn(),
  };
  syncUseCase = new SyncGroupsUseCase(instances, groups, gateway);
});

describe('SyncGroupsUseCase', () => {
  it('busca no WhatsApp e grava o cache', async () => {
    const result = await syncUseCase.execute({ userId: USER_ID });

    expect(gateway.listGroups).toHaveBeenCalledWith('pd_d3637abe5b584e5db838d23317aaad18', 'token-instancia');
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].name).toBe('Plano de Leitura 2026');
    expect(result.stale).toBe(false);
  });

  it('WhatsApp desconectado → exceção, e o cache NÃO é apagado', async () => {
    instances.findByUserId.mockResolvedValue(instancia(ConnectionStatus.DISCONNECTED));

    await expect(syncUseCase.execute({ userId: USER_ID })).rejects.toThrow(
      WhatsappNotConnectedException,
    );
    // Zerar o cache aqui apagaria a lista boa que o usuário já tinha.
    expect(groups.replaceAllForUser).not.toHaveBeenCalled();
    expect(gateway.listGroups).not.toHaveBeenCalled();
  });

  it('sem instância → exceção', async () => {
    instances.findByUserId.mockResolvedValue(null);
    await expect(syncUseCase.execute({ userId: USER_ID })).rejects.toThrow(
      WhatsappInstanceNotFoundException,
    );
  });

  it('descarta JID que não é de grupo', async () => {
    gateway.listGroups.mockResolvedValue([
      { jid: JID_A, name: 'Grupo', participantsCount: 3 },
      { jid: '5511999999999@s.whatsapp.net', name: 'Contato', participantsCount: null },
      { jid: 'lixo', name: 'Inválido', participantsCount: null },
    ]);

    const result = await syncUseCase.execute({ userId: USER_ID });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].jid).toBe(JID_A);
  });

  it('grupo que o usuário deixou desaparece do cache', async () => {
    groups.findAllByUserId.mockResolvedValue([grupoCache(JID_A, 'Antigo'), grupoCache('120363029999999999@g.us', 'Saí desse')]);
    gateway.listGroups.mockResolvedValue([{ jid: JID_A, name: 'Antigo', participantsCount: 5 }]);

    await syncUseCase.execute({ userId: USER_ID });

    const persistidos = groups.replaceAllForUser.mock.calls[0][1];
    expect(persistidos.map((g) => g.jid.value)).toEqual([JID_A]);
  });

  it('nome renomeado no WhatsApp é atualizado no cache', async () => {
    groups.findAllByUserId.mockResolvedValue([grupoCache(JID_A, 'Nome Antigo')]);
    gateway.listGroups.mockResolvedValue([{ jid: JID_A, name: 'Nome Novo', participantsCount: 7 }]);

    await syncUseCase.execute({ userId: USER_ID });

    const persistidos = groups.replaceAllForUser.mock.calls[0][1];
    expect(persistidos[0].name).toBe('Nome Novo');
    expect(persistidos[0].participantsCount).toBe(7);
  });

  it('grupo sem nome recebe rótulo em vez de string vazia', async () => {
    gateway.listGroups.mockResolvedValue([{ jid: JID_A, name: '   ', participantsCount: null }]);
    const result = await syncUseCase.execute({ userId: USER_ID });
    expect(result.groups[0].name).toBe('(sem nome)');
  });
});

describe('ListGroupsUseCase', () => {
  it('lê do cache sem chamar o provider', async () => {
    groups.findAllByUserId.mockResolvedValue([grupoCache(JID_A, 'Do cache')]);
    const useCase = new ListGroupsUseCase(groups, syncUseCase);

    const result = await useCase.execute({ userId: USER_ID });

    expect(gateway.listGroups).not.toHaveBeenCalled();
    expect(result.groups[0].name).toBe('Do cache');
  });

  it('refresh=true força ida ao provider', async () => {
    groups.findAllByUserId.mockResolvedValue([grupoCache(JID_A, 'Do cache')]);
    const useCase = new ListGroupsUseCase(groups, syncUseCase);

    await useCase.execute({ userId: USER_ID, refresh: true });

    expect(gateway.listGroups).toHaveBeenCalled();
  });

  it('cache vazio sincroniza sozinho (primeira abertura da tela)', async () => {
    groups.findAllByUserId.mockResolvedValue([]);
    const useCase = new ListGroupsUseCase(groups, syncUseCase);

    await useCase.execute({ userId: USER_ID });

    expect(gateway.listGroups).toHaveBeenCalled();
  });

  it(`marca stale quando o cache passa de ${GROUP_CACHE_MAX_AGE_DAYS} dias`, async () => {
    const antigo = new Date(Date.now() - (GROUP_CACHE_MAX_AGE_DAYS + 1) * 86_400_000);
    groups.findAllByUserId.mockResolvedValue([grupoCache(JID_A, 'Velho', antigo)]);
    const useCase = new ListGroupsUseCase(groups, syncUseCase);

    const result = await useCase.execute({ userId: USER_ID });

    expect(result.stale).toBe(true);
    // Stale não dispara sync automática: quem decide é o usuário (ou o dispatch, na Fase 6).
    expect(gateway.listGroups).not.toHaveBeenCalled();
  });

  it('cache recente não é stale', async () => {
    groups.findAllByUserId.mockResolvedValue([grupoCache(JID_A, 'Recente', new Date())]);
    const useCase = new ListGroupsUseCase(groups, syncUseCase);

    expect((await useCase.execute({ userId: USER_ID })).stale).toBe(false);
  });
});
