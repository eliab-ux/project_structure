import { DiagnoseWebhookUseCase } from '../../../src/contexts/channel/application/use-cases/diagnose-webhook/diagnose-webhook.use-case';
import { DiagnoseWebhookCommand } from '../../../src/contexts/channel/application/use-cases/diagnose-webhook/diagnose-webhook.command';
import { ChannelRepositoryPort } from '../../../src/contexts/channel/application/ports/output/channel-repository.port';
import { Channel } from '../../../src/contexts/channel/domain/entities/channel.entity';
import { ChannelId } from '../../../src/contexts/channel/domain/value-objects/channel-id.vo';
import { ChannelStatus } from '../../../src/contexts/channel/domain/value-objects/channel-status.vo';
import { QuotaBand } from '../../../src/contexts/channel/domain/value-objects/quota-band.vo';
import { ChannelNotFoundException } from '../../../src/contexts/channel/domain/exceptions/channel-not-found.exception';
import {
  GatewayWebhookInfo,
  WhatsAppGatewayPort,
} from '../../../src/infrastructure/whatsapp/ports/whatsapp-gateway.port';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';
import {
  ChannelInboundFacts,
  WebhookDiagnosisSourcePort,
} from '../../../src/contexts/channel/application/ports/output/webhook-diagnosis-source.port';
import { WebhookRejectionLog } from '../../../src/infrastructure/security/webhook-rejection.log';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const CHANNEL_ID = 'cccccccc-1111-4111-8111-111111111111';

/** Props isoladas para um teste poder trocar UM campo (o nome da instância) sem repetir o resto. */
function channelProps() {
  return {
    id: ChannelId.from(CHANNEL_ID),
    accountId: ACCOUNT_ID,
    label: 'Chip 1',
    phone: PhoneE164.create('11999998888'),
    evolutionInstanceName: `acct-${ACCOUNT_ID}-ch-${CHANNEL_ID}`,
    status: ChannelStatus.CONNECTED,
    quota: QuotaBand.create(20, 150, 20),
    warmupStartedAt: null,
    lastSendAt: null,
    lastQuotaReviewAt: null,
    consecutiveFailures: 0,
    disconnectEventsToday: 0,
    lastDisconnectAt: null,
    retiredAt: null,
    retiredBy: null,
    terminalReason: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
  };
}

function channel(): Channel {
  return Channel.reconstitute(channelProps());
}

function healthy(): GatewayWebhookInfo {
  return {
    enabled: true,
    url: 'https://batuta.techbs.com.br/api/webhooks/evolution',
    events: ['CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE'],
    hasAuthHeader: true,
  };
}

/** Default: replies HAVE been arriving, so "tudo no lugar" genuinely means the whole chain works. */
function facts(overrides: Partial<ChannelInboundFacts> = {}): ChannelInboundFacts {
  return {
    inboundCount: 5,
    lastInboundAt: new Date('2026-08-08T12:00:00Z'),
    contactsTotal: 7,
    contactsWithoutNinthDigit: 0,
    ...overrides,
  };
}

/**
 * The diagnosis exists because "a resposta não chegou" has five causes that look identical from
 * outside — and every one of these tests is one of those causes, phrased as the screen has to phrase
 * it. What is asserted is that the right cause is named, because naming the wrong one sends the
 * operator to fix something that was never broken.
 */
describe('DiagnoseWebhookUseCase', () => {
  let channels: jest.Mocked<ChannelRepositoryPort>;
  let gateway: jest.Mocked<WhatsAppGatewayPort>;
  let source: jest.Mocked<WebhookDiagnosisSourcePort>;
  let rejections: WebhookRejectionLog;
  let useCase: DiagnoseWebhookUseCase;

  const read = new DiagnoseWebhookCommand(ACCOUNT_ID, CHANNEL_ID, false);

  beforeEach(() => {
    channels = {
      findById: jest.fn(async () => channel()),
    } as unknown as jest.Mocked<ChannelRepositoryPort>;
    gateway = {
      findWebhook: jest.fn(async () => healthy()),
      ensureWebhook: jest.fn(async () => true),
    } as unknown as jest.Mocked<WhatsAppGatewayPort>;

    source = {
      inboundFacts: jest.fn(async () => facts()),
    } as unknown as jest.Mocked<WebhookDiagnosisSourcePort>;
    rejections = new WebhookRejectionLog();

    useCase = new DiagnoseWebhookUseCase(channels, gateway, source, rejections);
  });

  it('não relata problema quando está tudo no lugar', async () => {
    const result = await useCase.execute(read);

    expect(result.problem).toBeNull();
    expect(result.receivesInbound).toBe(true);
    expect(result.receivesAcks).toBe(true);
  });

  it('ler NÃO reconfigura — é o que permite ver o defeito', async () => {
    await useCase.execute(read);

    // Uma tela que consertasse em silêncio o que foi aberta para inspecionar nunca deixaria
    // ninguém observar o estado quebrado.
    expect(gateway.ensureWebhook).not.toHaveBeenCalled();
    expect((await useCase.execute(read)).reconfigured).toBeNull();
  });

  it('reconfigura antes de reler quando pedido, e diz se funcionou', async () => {
    const result = await useCase.execute(new DiagnoseWebhookCommand(ACCOUNT_ID, CHANNEL_ID, true));

    expect(gateway.ensureWebhook).toHaveBeenCalledTimes(1);
    expect(result.reconfigured).toBe(true);
  });

  it('sem webhook nenhum: aponta as duas consequências, resposta e recibo', async () => {
    gateway.findWebhook.mockResolvedValue(null);

    const result = await useCase.execute(read);

    expect(result.configured).toBe(false);
    expect(result.problem).toMatch(/não tem webhook configurado/);
    // O recibo importa tanto quanto a resposta: sem ele o throttle lê 0% de entrega.
    expect(result.problem).toMatch(/cota/);
  });

  it('webhook desabilitado é o caso que engana: parece configurado e não entrega', async () => {
    gateway.findWebhook.mockResolvedValue({ ...healthy(), enabled: false });

    const result = await useCase.execute(read);

    expect(result.problem).toMatch(/DESABILITADO/);
  });

  it('sem o cabeçalho de autenticação, explica o 401 em vez de dizer "sem mensagens"', async () => {
    gateway.findWebhook.mockResolvedValue({ ...healthy(), hasAuthHeader: false });

    const result = await useCase.execute(read);

    expect(result.problem).toMatch(/401/);
  });

  it('sem MESSAGES_UPSERT: distingue "conexão chega, resposta não"', async () => {
    gateway.findWebhook.mockResolvedValue({
      ...healthy(),
      events: ['CONNECTION_UPDATE', 'MESSAGES_UPDATE'],
    });

    const result = await useCase.execute(read);

    expect(result.receivesInbound).toBe(false);
    expect(result.problem).toMatch(/MESSAGES_UPSERT/);
  });

  it('sem MESSAGES_UPDATE: o problema é a cota caindo, não a resposta', async () => {
    gateway.findWebhook.mockResolvedValue({
      ...healthy(),
      events: ['CONNECTION_UPDATE', 'MESSAGES_UPSERT'],
    });

    const result = await useCase.execute(read);

    expect(result.receivesInbound).toBe(true);
    expect(result.problem).toMatch(/MESSAGES_UPDATE/);
  });

  it('relata UM problema por vez, na ordem em que eles bloqueiam', async () => {
    // Nada configurado é também "sem evento" e "sem cabeçalho"; cinco reclamações para uma causa só
    // leem como cinco defeitos.
    gateway.findWebhook.mockResolvedValue(null);

    const result = await useCase.execute(read);

    expect(result.problem).not.toMatch(/MESSAGES_UPSERT/);
  });

  it('o token nunca aparece no resultado, só a presença do cabeçalho', async () => {
    const result = await useCase.execute(read);

    expect(JSON.stringify(result)).not.toContain('x-batuta-webhook-token');
    expect(result.hasAuthHeader).toBe(true);
  });

  it('404 quando o canal não existe — inclusive o de outra conta', async () => {
    channels.findById.mockResolvedValue(null);

    await expect(useCase.execute(read)).rejects.toThrow(ChannelNotFoundException);
  });
  // ---- beyond the provider's config: the links after the POST -------------------------------------
  //
  // These exist because "os cinco itens verdes e o inbox vazio" was a real production state that cost a
  // long investigation through container logs. Everything above only describes what the PROVIDER has
  // configured; a correct configuration proves nothing about the message actually landing.

  describe('a cadeia depois do POST', () => {
    it('nome de instância fora do padrão bloqueia TUDO, e vem antes de qualquer check de webhook', async () => {
      // O tenant de um inbound vem do nome da instância — jamais do corpo do payload, que um portador do
      // token compartilhado poderia apontar para qualquer conta. Nome que não casa = descarte antes de
      // tudo, e reconfigurar o webhook não conserta.
      channels.findById.mockResolvedValue(
        Channel.reconstitute({
          ...channelProps(),
          evolutionInstanceName: 'eliab',
        }),
      );

      const result = await useCase.execute(read);

      expect(result.instanceNameAttributable).toBe(false);
      expect(result.problem).toMatch(/não segue o padrão/);
      // O ponto que evita o operador clicar em Reconfigurar e acreditar que resolveu.
      expect(result.problem).toMatch(/NÃO resolve/);
    });

    it('nome fora do padrão tem precedência sobre webhook ausente', async () => {
      channels.findById.mockResolvedValue(
        Channel.reconstitute({ ...channelProps(), evolutionInstanceName: 'chip-eliab' }),
      );
      gateway.findWebhook.mockResolvedValue(null);

      const result = await useCase.execute(read);

      // Reconfigurar o webhook de uma instância inatribuível é trabalho jogado fora.
      expect(result.problem).toMatch(/não segue o padrão/);
      expect(result.problem).not.toMatch(/não tem webhook configurado/);
    });

    it('recusa por token inválido prova que a Evolution ESTÁ chamando', async () => {
      // O check do cabeçalho só vê presença, nunca o valor — é o furo que deixava um token divergente
      // passar como ✔ enquanto o backend respondia 401 a cada chamada.
      rejections.recordInvalidToken();
      rejections.recordInvalidToken();

      const result = await useCase.execute(read);

      expect(result.invalidTokenRejections).toBe(2);
      expect(result.problem).toMatch(/ESTÁ chamando/);
      expect(result.problem).toMatch(/EVOLUTION_WEBHOOK_TOKEN/);
    });

    it('nono dígito: nomeia o defeito em que o envio funciona e só a volta quebra', async () => {
      source.inboundFacts.mockResolvedValue(
        facts({ inboundCount: 0, contactsTotal: 7, contactsWithoutNinthDigit: 3 }),
      );

      const result = await useCase.execute(read);

      expect(result.problem).toMatch(/nono dígito/);
      expect(result.problem).toMatch(/ENVIO/);
      expect(result.problem).toMatch(/VOLTA/);
    });

    it('config correta e nada gravado: manda olhar a requisição, não adivinhar', async () => {
      source.inboundFacts.mockResolvedValue(facts({ inboundCount: 0 }));

      const result = await useCase.execute(read);

      expect(result.problem).toMatch(/POST \/api\/webhooks\/evolution/);
      // E avisa do que não tem volta: não existe importação de histórico.
      expect(result.problem).toMatch(/não são recuperáveis/);
    });

    it('token inválido tem precedência sobre "nada chegou" — é a causa, não o sintoma', async () => {
      rejections.recordInvalidToken();
      source.inboundFacts.mockResolvedValue(facts({ inboundCount: 0 }));

      const result = await useCase.execute(read);

      expect(result.problem).toMatch(/token inválido/);
    });

    it('não inventa problema quando a resposta chegou de verdade', async () => {
      const result = await useCase.execute(read);

      expect(result.inboundCount).toBe(5);
      expect(result.problem).toBeNull();
    });

    it('carrega os fatos para a tela — declarado e nunca mapeado já custou caro aqui', async () => {
      source.inboundFacts.mockResolvedValue(
        facts({ inboundCount: 2, contactsTotal: 9, contactsWithoutNinthDigit: 4 }),
      );

      const result = await useCase.execute(read);

      expect(result.contactsTotal).toBe(9);
      expect(result.contactsWithoutNinthDigit).toBe(4);
      expect(result.instanceName).toBe(`acct-${ACCOUNT_ID}-ch-${CHANNEL_ID}`);
      expect(result.lastInboundAt).toBeInstanceOf(Date);
    });
  });
});
