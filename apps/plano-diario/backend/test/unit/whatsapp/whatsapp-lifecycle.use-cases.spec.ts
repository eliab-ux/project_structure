import { WhatsappGatewayPort } from '../../../src/contexts/whatsapp/application/ports/output/whatsapp-gateway.port';
import { WhatsappInstanceRepositoryPort } from '../../../src/contexts/whatsapp/application/ports/output/whatsapp-instance-repository.port';
import { DeleteInstanceUseCase } from '../../../src/contexts/whatsapp/application/use-cases/delete-instance/delete-instance.use-case';
import { DisconnectWhatsappUseCase } from '../../../src/contexts/whatsapp/application/use-cases/disconnect-whatsapp/disconnect-whatsapp.use-case';
import { GetConnectionStateUseCase } from '../../../src/contexts/whatsapp/application/use-cases/get-connection-state/get-connection-state.use-case';
import { WhatsappInstance } from '../../../src/contexts/whatsapp/domain/entities/whatsapp-instance.entity';
import { WhatsappInstanceNotFoundException } from '../../../src/contexts/whatsapp/domain/exceptions/whatsapp-instance-not-found.exception';
import { ConnectionStatus } from '../../../src/contexts/whatsapp/domain/value-objects/connection-status.vo';
import { InstanceName } from '../../../src/contexts/whatsapp/domain/value-objects/instance-name.vo';

const USER_ID = 'd3637abe-5b58-4e5d-b838-d23317aaad18';

function conectada(): WhatsappInstance {
  const i = WhatsappInstance.create({
    userId: USER_ID,
    instanceName: InstanceName.forUser(USER_ID),
    token: 'token-instancia',
  });
  i.syncStatus(ConnectionStatus.CONNECTED, '5511999999999');
  i.pullDomainEvents();
  return i;
}

let repository: jest.Mocked<WhatsappInstanceRepositoryPort>;
let gateway: jest.Mocked<WhatsappGatewayPort>;

beforeEach(() => {
  repository = {
    save: jest.fn((i) => Promise.resolve(i)),
    findByUserId: jest.fn().mockResolvedValue(conectada()),
    findByInstanceName: jest.fn(),
    delete: jest.fn(),
  };
  gateway = {
    createInstance: jest.fn(),
    connect: jest.fn(),
    getConnectionState: jest.fn().mockResolvedValue({ status: 'connected', connectedNumber: '5511999999999' }),
    listGroups: jest.fn(),
    sendText: jest.fn(),
    sendImageWithCaption: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
    deleteInstance: jest.fn().mockResolvedValue(undefined),
  };
});

describe('GetConnectionStateUseCase', () => {
  it('usuário sem WhatsApp devolve null (não é erro)', async () => {
    repository.findByUserId.mockResolvedValue(null);
    const useCase = new GetConnectionStateUseCase(repository, gateway);

    await expect(useCase.execute({ userId: USER_ID })).resolves.toBeNull();
    expect(gateway.getConnectionState).not.toHaveBeenCalled();
  });

  it('consulta o provider e reflete o status no banco', async () => {
    gateway.getConnectionState.mockResolvedValue({ status: 'disconnected' });
    const useCase = new GetConnectionStateUseCase(repository, gateway);

    const dto = await useCase.execute({ userId: USER_ID });

    expect(dto?.status).toBe('disconnected');
    expect(dto?.connectedNumber).toBeNull();
    expect(repository.save).toHaveBeenCalled();
  });

  it('provider fora do ar devolve o último estado conhecido em vez de falhar a tela', async () => {
    gateway.getConnectionState.mockRejectedValue(new Error('timeout'));
    const useCase = new GetConnectionStateUseCase(repository, gateway);

    const dto = await useCase.execute({ userId: USER_ID });

    expect(dto?.status).toBe('connected');
  });

  it('o DTO nunca carrega o token da instância', async () => {
    const useCase = new GetConnectionStateUseCase(repository, gateway);
    const dto = await useCase.execute({ userId: USER_ID });
    expect(JSON.stringify(dto)).not.toContain('token-instancia');
  });
});

describe('DisconnectWhatsappUseCase', () => {
  it('faz logout no provider e marca desconectado', async () => {
    const useCase = new DisconnectWhatsappUseCase(repository, gateway);

    await useCase.execute({ userId: USER_ID });

    expect(gateway.logout).toHaveBeenCalledWith('pd_d3637abe5b584e5db838d23317aaad18', 'token-instancia');
    const salva = repository.save.mock.calls[0][0] as WhatsappInstance;
    expect(salva.status.value).toBe('disconnected');
  });

  it('logout que falha no provider ainda marca desconectado localmente', async () => {
    gateway.logout.mockRejectedValue(new Error('instância não existe mais'));
    const useCase = new DisconnectWhatsappUseCase(repository, gateway);

    await useCase.execute({ userId: USER_ID });

    const salva = repository.save.mock.calls[0][0] as WhatsappInstance;
    expect(salva.status.value).toBe('disconnected');
  });

  it('sem instância → exceção de domínio', async () => {
    repository.findByUserId.mockResolvedValue(null);
    const useCase = new DisconnectWhatsappUseCase(repository, gateway);
    await expect(useCase.execute({ userId: USER_ID })).rejects.toThrow(
      WhatsappInstanceNotFoundException,
    );
  });
});

describe('DeleteInstanceUseCase', () => {
  it('apaga no provider e remove o registro local', async () => {
    const useCase = new DeleteInstanceUseCase(repository, gateway);

    await useCase.execute({ userId: USER_ID });

    expect(gateway.deleteInstance).toHaveBeenCalledWith('pd_d3637abe5b584e5db838d23317aaad18');
    expect(repository.delete).toHaveBeenCalled();
  });

  it('falha no provider não impede a remoção local (senão o usuário não reconecta)', async () => {
    gateway.deleteInstance.mockRejectedValue(new Error('404'));
    const useCase = new DeleteInstanceUseCase(repository, gateway);

    await useCase.execute({ userId: USER_ID });

    expect(repository.delete).toHaveBeenCalled();
  });
});
