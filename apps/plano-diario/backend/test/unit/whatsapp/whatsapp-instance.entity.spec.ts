import { WhatsappInstance } from '../../../src/contexts/whatsapp/domain/entities/whatsapp-instance.entity';
import { WhatsappConnectedEvent } from '../../../src/contexts/whatsapp/domain/events/whatsapp-connected.event';
import { WhatsappDisconnectedEvent } from '../../../src/contexts/whatsapp/domain/events/whatsapp-disconnected.event';
import { ConnectionStatus } from '../../../src/contexts/whatsapp/domain/value-objects/connection-status.vo';
import { InstanceName } from '../../../src/contexts/whatsapp/domain/value-objects/instance-name.vo';

const USER_ID = 'd3637abe-5b58-4e5d-b838-d23317aaad18';

function novaInstancia(): WhatsappInstance {
  return WhatsappInstance.create({
    userId: USER_ID,
    instanceName: InstanceName.forUser(USER_ID),
    token: 'token-da-instancia',
  });
}

describe('WhatsappInstance', () => {
  it('nasce aguardando o QR, sem número conectado', () => {
    const instance = novaInstancia();
    expect(instance.status).toBe(ConnectionStatus.PENDING_QR);
    expect(instance.connectedNumber).toBeNull();
    expect(instance.pullDomainEvents()).toHaveLength(0);
  });

  it('emite WhatsappConnectedEvent na transição para conectado', () => {
    const instance = novaInstancia();
    instance.syncStatus(ConnectionStatus.CONNECTED, '5511999999999');

    const events = instance.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(WhatsappConnectedEvent);
    expect(instance.connectedNumber).toBe('5511999999999');
  });

  it('não reemite o evento a cada polling enquanto segue conectado', () => {
    const instance = novaInstancia();
    instance.syncStatus(ConnectionStatus.CONNECTED, '5511999999999');
    instance.pullDomainEvents();

    instance.syncStatus(ConnectionStatus.CONNECTED, '5511999999999');
    instance.syncStatus(ConnectionStatus.CONNECTED, '5511999999999');

    expect(instance.pullDomainEvents()).toHaveLength(0);
  });

  it('emite WhatsappDisconnectedEvent ao cair e limpa o número', () => {
    const instance = novaInstancia();
    instance.syncStatus(ConnectionStatus.CONNECTED, '5511999999999');
    instance.pullDomainEvents();

    instance.syncStatus(ConnectionStatus.DISCONNECTED);

    const events = instance.pullDomainEvents();
    expect(events[0]).toBeInstanceOf(WhatsappDisconnectedEvent);
    // O número não pode continuar na tela depois de desconectar.
    expect(instance.connectedNumber).toBeNull();
  });

  it('qualquer status não-conectado limpa o número', () => {
    const instance = novaInstancia();
    instance.syncStatus(ConnectionStatus.CONNECTED, '5511999999999');
    instance.markError();
    expect(instance.connectedNumber).toBeNull();
    expect(instance.status).toBe(ConnectionStatus.ERROR);
  });

  it('atualiza lastStatusAt em cada sincronização', () => {
    const instance = novaInstancia();
    const antes = instance.lastStatusAt.getTime();
    instance.syncStatus(ConnectionStatus.CONNECTING);
    expect(instance.lastStatusAt.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it('replaceToken troca o token da instância', () => {
    const instance = novaInstancia();
    instance.replaceToken('token-novo');
    expect(instance.token).toBe('token-novo');
  });
});

describe('InstanceName', () => {
  it('deriva pd_ + uuid sem hífens', () => {
    expect(InstanceName.forUser(USER_ID).value).toBe('pd_d3637abe5b584e5db838d23317aaad18');
  });

  it('é estável: o mesmo usuário sempre gera o mesmo nome', () => {
    expect(InstanceName.forUser(USER_ID).value).toBe(InstanceName.forUser(USER_ID).value);
  });

  it.each(['', 'nao-e-uuid', '123', 'd3637abe-5b58-4e5d-b838'])(
    'recusa userId inválido: %s',
    (id) => {
      expect(() => InstanceName.forUser(id)).toThrow();
    },
  );

  it('não aceita nome de instância de outro sistema', () => {
    // Impede que um valor adulterado no banco aponte para a instância do EMDR.
    expect(() => InstanceName.from('emdr')).toThrow();
    expect(() => InstanceName.from('louvorapp')).toThrow();
  });
});

describe('ConnectionStatus.fromProviderState', () => {
  it.each([
    ['open', 'connected'],
    ['connecting', 'connecting'],
    ['close', 'disconnected'],
    ['closed', 'disconnected'],
  ])('traduz "%s" para "%s"', (provider, esperado) => {
    expect(ConnectionStatus.fromProviderState(provider).value).toBe(esperado);
  });

  it.each([undefined, null, '', 'estado-que-nao-conheco'])(
    'estado desconhecido (%s) vira disconnected, NUNCA connected',
    (state) => {
      expect(ConnectionStatus.fromProviderState(state).value).toBe('disconnected');
    },
  );
});
