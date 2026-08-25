import { WhatsappGatewayPort } from '../../../src/contexts/whatsapp/application/ports/output/whatsapp-gateway.port';
import { WhatsappInstanceRepositoryPort } from '../../../src/contexts/whatsapp/application/ports/output/whatsapp-instance-repository.port';
import { ConnectWhatsappUseCase } from '../../../src/contexts/whatsapp/application/use-cases/connect-whatsapp/connect-whatsapp.use-case';
import { WhatsappInstance } from '../../../src/contexts/whatsapp/domain/entities/whatsapp-instance.entity';
import { ProviderInstanceMissingException } from '../../../src/contexts/whatsapp/domain/exceptions/provider-instance-missing.exception';
import { ConnectionStatus } from '../../../src/contexts/whatsapp/domain/value-objects/connection-status.vo';
import { InstanceName } from '../../../src/contexts/whatsapp/domain/value-objects/instance-name.vo';

const USER_ID = 'd3637abe-5b58-4e5d-b838-d23317aaad18';
const INSTANCE_NAME = 'pd_d3637abe5b584e5db838d23317aaad18';

function instanciaExistente(status = ConnectionStatus.PENDING_QR): WhatsappInstance {
  const instance = WhatsappInstance.create({
    userId: USER_ID,
    instanceName: InstanceName.forUser(USER_ID),
    token: 'token-existente',
  });
  instance.syncStatus(status, status.isConnected ? '5511999999999' : null);
  instance.pullDomainEvents();
  return instance;
}

describe('ConnectWhatsappUseCase', () => {
  let repository: jest.Mocked<WhatsappInstanceRepositoryPort>;
  let gateway: jest.Mocked<WhatsappGatewayPort>;
  let useCase: ConnectWhatsappUseCase;

  beforeEach(() => {
    repository = {
      save: jest.fn((i) => Promise.resolve(i)),
      findByUserId: jest.fn().mockResolvedValue(null),
      findByInstanceName: jest.fn(),
      delete: jest.fn(),
    };
    gateway = {
      createInstance: jest.fn().mockResolvedValue({ token: 'token-novo' }),
      connect: jest.fn().mockResolvedValue({ status: 'pending_qr', qrCodeBase64: 'data:image/png;base64,AAA' }),
      getConnectionState: jest.fn(),
      listGroups: jest.fn(),
      sendText: jest.fn(),
      sendImageWithCaption: jest.fn(),
      logout: jest.fn(),
      deleteInstance: jest.fn(),
    };
    useCase = new ConnectWhatsappUseCase(repository, gateway);
  });

  it('primeira conexão: cria instância NOVA e devolve o QR', async () => {
    const qr = await useCase.execute({ userId: USER_ID });

    expect(gateway.createInstance).toHaveBeenCalledWith(INSTANCE_NAME);
    expect(qr.qrCodeBase64).toBe('data:image/png;base64,AAA');
    expect(qr.status).toBe('pending_qr');
    expect(qr.expiresInSeconds).toBe(60);
  });

  it('não reaproveita instância de outro sistema: o nome é derivado do userId', async () => {
    await useCase.execute({ userId: USER_ID });
    const nome = gateway.createInstance.mock.calls[0][0];
    expect(nome).toMatch(/^pd_[0-9a-f]{32}$/);
    expect(nome).not.toBe('emdr');
  });

  it('instância já existente: gera QR novo sem criar outra', async () => {
    repository.findByUserId.mockResolvedValue(instanciaExistente());

    await useCase.execute({ userId: USER_ID });

    expect(gateway.createInstance).not.toHaveBeenCalled();
    expect(gateway.connect).toHaveBeenCalledWith(INSTANCE_NAME, 'token-existente');
  });

  it('já conectado: NÃO gera QR (derrubaria a sessão que funciona)', async () => {
    repository.findByUserId.mockResolvedValue(instanciaExistente(ConnectionStatus.CONNECTED));

    const qr = await useCase.execute({ userId: USER_ID });

    expect(gateway.connect).not.toHaveBeenCalled();
    expect(qr.status).toBe('connected');
    expect(qr.qrCodeBase64).toBeUndefined();
    expect(qr.expiresInSeconds).toBe(0);
  });

  it('provider responde já pareado: marca conectado com o número', async () => {
    gateway.connect.mockResolvedValue({ status: 'connected', connectedNumber: '5511988887777' });

    const qr = await useCase.execute({ userId: USER_ID });

    expect(qr.status).toBe('connected');
    const salva = repository.save.mock.calls.at(-1)?.[0] as WhatsappInstance;
    expect(salva.connectedNumber).toBe('5511988887777');
  });

  it('o QR nunca vem acompanhado do token da instância', async () => {
    const qr = await useCase.execute({ userId: USER_ID });
    expect(JSON.stringify(qr)).not.toContain('token-novo');
  });

  it('falha do gateway propaga (o controller devolve erro genérico)', async () => {
    gateway.createInstance.mockRejectedValue(new Error('Evolution fora do ar'));
    await expect(useCase.execute({ userId: USER_ID })).rejects.toThrow();
    expect(repository.save).not.toHaveBeenCalled();
  });

  describe('instância apagada no provider', () => {
    beforeEach(() => {
      repository.findByUserId.mockResolvedValue(instanciaExistente());
      // Cenário real: a instância foi apagada no Evolution Manager. O registro do nosso banco
      // continua lá, apontando para o vazio, e o nome deriva do userId — então sem recuperação
      // TODA tentativa de conectar bate no mesmo 404, sem saída pela tela.
      gateway.connect
        .mockRejectedValueOnce(new ProviderInstanceMissingException())
        .mockResolvedValueOnce({ status: 'pending_qr', qrCodeBase64: 'data:image/png;base64,BBB' });
    });

    it('recria a instância e devolve o QR novo', async () => {
      const qr = await useCase.execute({ userId: USER_ID });

      expect(gateway.createInstance).toHaveBeenCalledWith(INSTANCE_NAME);
      expect(qr.qrCodeBase64).toBe('data:image/png;base64,BBB');
      expect(qr.status).toBe('pending_qr');
    });

    it('substitui o token morto e persiste antes de pedir o QR', async () => {
      await useCase.execute({ userId: USER_ID });

      // O token antigo morreu com a instância; a segunda tentativa usa o novo.
      expect(gateway.connect).toHaveBeenNthCalledWith(2, INSTANCE_NAME, 'token-novo');
      const salva = repository.save.mock.calls[0][0] as WhatsappInstance;
      expect(salva.token).toBe('token-novo');
    });

    it('reaproveita o MESMO registro (id, grupos e histórico preservados)', async () => {
      const existente = instanciaExistente();
      repository.findByUserId.mockResolvedValue(existente);

      await useCase.execute({ userId: USER_ID });

      expect((repository.save.mock.calls[0][0] as WhatsappInstance).id).toBe(existente.id);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('um segundo 404 não é insistido: propaga', async () => {
      gateway.connect.mockReset();
      gateway.connect.mockRejectedValue(new ProviderInstanceMissingException());

      await expect(useCase.execute({ userId: USER_ID })).rejects.toThrow(
        ProviderInstanceMissingException,
      );
      // Recriou uma vez só — insistir esconderia um problema diferente.
      expect(gateway.createInstance).toHaveBeenCalledTimes(1);
    });
  });
});
