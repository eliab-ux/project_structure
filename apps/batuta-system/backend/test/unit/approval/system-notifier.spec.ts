import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SystemNotifierAdapter } from '../../../src/infrastructure/notifications/system-notifier.adapter';
import { MailSenderPort } from '../../../src/contexts/auth/application/ports/output/mail-sender.port';

jest.mock('axios');
const axiosPost = axios.post as jest.MockedFunction<typeof axios.post>;

const NOTIFICATION = {
  recipientName: 'Ana',
  email: 'ana@exemplo.com',
  phoneE164: '+5511988887777',
  subject: 'Aprovação pendente: Aviso',
  body: 'Abra o link: https://app.batuta.test/aprovacao/abc',
};

describe('SystemNotifierAdapter (§8 item 3 — canal de SISTEMA)', () => {
  let mail: jest.Mocked<MailSenderPort>;
  let adapter: SystemNotifierAdapter;

  function build(env: Record<string, unknown> = {}): SystemNotifierAdapter {
    return new SystemNotifierAdapter(
      mail,
      new ConfigService({
        EVOLUTION_API_URL: 'https://evo.plataforma.test',
        EVOLUTION_API_KEY: 'chave-da-plataforma',
        EVOLUTION_SYSTEM_INSTANCE: 'batuta-sistema',
        ...env,
      }),
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mail = { send: jest.fn(async () => undefined) } as unknown as jest.Mocked<MailSenderPort>;
    axiosPost.mockResolvedValue({ status: 200, data: {} } as never);
    adapter = build();
  });

  it('sends e-mail through the platform SMTP and WhatsApp through the platform instance', async () => {
    const result = await adapter.notify(NOTIFICATION);

    expect(result.emailSent).toBe(true);
    expect(result.whatsAppSent).toBe(true);
    expect(result.failures).toEqual([]);

    const [url, payload, options] = axiosPost.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { headers: Record<string, string> },
    ];
    // The instance is the PLATFORM's, from config — never derived from an account.
    expect(url).toBe('https://evo.plataforma.test/message/sendText/batuta-sistema');
    expect(payload.number).toBe('5511988887777');
    expect(options.headers.apikey).toBe('chave-da-plataforma');
  });

  it('omits a channel the caller did not ask for', async () => {
    const result = await adapter.notify({ ...NOTIFICATION, phoneE164: null });

    expect(result.emailSent).toBe(true);
    expect(result.whatsAppSent).toBe(false);
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it('an SMTP failure does not stop the WhatsApp link, and is reported', async () => {
    mail.send.mockRejectedValue(new Error('conexão recusada'));

    const result = await adapter.notify(NOTIFICATION);

    expect(result.emailSent).toBe(false);
    expect(result.whatsAppSent).toBe(true);
    expect(result.failures).toEqual(['e-mail: conexão recusada']);
  });

  it('a 4xx from Evolution is reported, never thrown at the caller', async () => {
    axiosPost.mockResolvedValue({ status: 401, data: {} } as never);

    const result = await adapter.notify(NOTIFICATION);

    // The submission is already committed by the time this runs: failing it would lose the requests.
    expect(result.whatsAppSent).toBe(false);
    expect(result.failures[0]).toMatch(/HTTP 401/);
  });

  it('says exactly what is missing when the system channel is not configured', async () => {
    const result = await build({ EVOLUTION_SYSTEM_INSTANCE: undefined }).notify(NOTIFICATION);

    expect(result.failures[0]).toMatch(/EVOLUTION_SYSTEM_INSTANCE/);
  });

  it('never logs the body — it contains the magic-link token', async () => {
    mail.send.mockRejectedValue(new Error('falhou'));
    const warn = jest.spyOn(adapter['logger'], 'warn').mockImplementation(() => undefined);

    await adapter.notify(NOTIFICATION);

    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).not.toContain('aprovacao/abc');
  });

  /**
   * The structural guarantee, asserted on the source itself.
   *
   * "Nunca por chip de tenant" cannot be proved by calling the adapter — a future edit could add a
   * tenant lookup and every behavioural test above would still pass. So this reads the file: the
   * approval channel must have no reference to the per-account server resolver, to the tenant gateway,
   * or to any accountId at all.
   */
  it('has no code path to a tenant chip', () => {
    const source = readFileSync(
      join(__dirname, '../../../src/infrastructure/notifications/system-notifier.adapter.ts'),
      'utf-8',
    );
    // Comments are stripped first: the docblock explains this very rule by naming the resolver, and a
    // rule stated in prose is not the thing being asserted — the code is.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).not.toContain('EvolutionServerResolver');
    expect(code).not.toContain('EVOLUTION_SHARED_APIKEY');
    expect(code).not.toContain('WhatsAppGatewayPort');
    expect(code).not.toContain('ChannelRepositoryPort');
    // No accountId reaches this class, so there is nothing to resolve a customer server from.
    expect(code).not.toMatch(/accountId/);
  });
});
