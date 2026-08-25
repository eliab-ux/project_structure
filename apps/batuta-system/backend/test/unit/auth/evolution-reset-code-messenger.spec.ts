import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import { EvolutionResetCodeMessenger } from '../../../src/infrastructure/notifications/evolution-reset-code-messenger.adapter';
import { RecoveryChannelUnavailableException } from '../../../src/contexts/auth/domain/exceptions/recovery-channel-unavailable.exception';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const post = jest.fn();

const MESSAGE = {
  phoneE164: '+5511988887777',
  name: 'Maria',
  code: '123456',
  expiresInMinutes: 15,
};

function build(env: Record<string, unknown> = {}): EvolutionResetCodeMessenger {
  return new EvolutionResetCodeMessenger(
    new ConfigService({
      BATUTA_APP_NAME: 'Batuta',
      EVOLUTION_API_URL: 'https://evo.plataforma.test/',
      EVOLUTION_API_KEY: 'chave-GLOBAL',
      EVOLUTION_SYSTEM_INSTANCE: 'batuta-sistema',
      EVOLUTION_SYSTEM_APIKEY: 'chave-da-INSTANCIA',
      ...env,
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  post.mockResolvedValue({ status: 200, data: {} });
  mockedAxios.create.mockReturnValue({ post } as never);
});

describe('EvolutionResetCodeMessenger', () => {
  it('posts to sendText of the SYSTEM instance, with digits only in the number', async () => {
    await build().sendResetCode(MESSAGE);

    const [url, body] = post.mock.calls[0];
    // Trailing slash of the base URL must not produce a double slash in the path.
    expect(url).toBe('https://evo.plataforma.test/message/sendText/batuta-sistema');
    expect(body.number).toBe('5511988887777');
  });

  it('uses the INSTANCE apikey, not the global one', async () => {
    await build().sendResetCode(MESSAGE);

    // Least privilege: sending a message must not carry the power to create or delete instances.
    expect(post.mock.calls[0][2].headers.apikey).toBe('chave-da-INSTANCIA');
  });

  it('falls back to the global key when the instance key is absent', async () => {
    await build({ EVOLUTION_SYSTEM_APIKEY: undefined }).sendResetCode(MESSAGE);

    expect(post.mock.calls[0][2].headers.apikey).toBe('chave-GLOBAL');
  });

  it('writes the code in the message and nothing that looks like a link', async () => {
    await build().sendResetCode(MESSAGE);

    const text: string = post.mock.calls[0][1].text;
    expect(text).toContain('*123456*');
    expect(text).toContain('Maria');
    expect(text).toContain('15 minutos');
    // A code arriving next to a link is exactly the shape a phishing message imitates.
    expect(text).not.toMatch(/https?:\/\//);
  });

  it('refuses BEFORE any request when the channel is not configured', async () => {
    const messenger = build({ EVOLUTION_SYSTEM_INSTANCE: undefined });

    expect(() => messenger.ensureAvailable()).toThrow(RecoveryChannelUnavailableException);
    await expect(messenger.sendResetCode(MESSAGE)).rejects.toThrow(
      RecoveryChannelUnavailableException,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('treats a non-2xx answer as a failure, so the caller does not mark the code as sent', async () => {
    post.mockResolvedValue({ status: 400, data: { message: 'number does not exist' } });

    await expect(build().sendResetCode(MESSAGE)).rejects.toThrow(/WhatsApp/);
  });

  it('never logs the code, the number or the apikey — not even on the failure path', async () => {
    const lines: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((...args) => lines.push(args));
    jest.spyOn(Logger.prototype, 'error').mockImplementation((...args) => lines.push(args));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((...args) => lines.push(args));

    await build().sendResetCode(MESSAGE);
    post.mockRejectedValue(new Error('network down'));
    await expect(build().sendResetCode(MESSAGE)).rejects.toThrow();

    const logged = JSON.stringify(lines);
    expect(logged).not.toContain('123456');
    expect(logged).not.toContain('988887777');
    expect(logged).not.toContain('chave-da-INSTANCIA');
    expect(logged).not.toContain('chave-GLOBAL');
  });

  it('warns at boot when the channel is incomplete, and does NOT throw', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    // A throw here would take down sending, the inbox and every screen because password recovery
    // is misconfigured — a worse outcome than a degraded recovery.
    expect(() =>
      build({ EVOLUTION_SYSTEM_INSTANCE: undefined }).onApplicationBootstrap(),
    ).not.toThrow();
    expect(warn.mock.calls[0][0]).toMatch(/EVOLUTION_SYSTEM_INSTANCE/);
  });

  it('warns at boot when it is falling back to the global key', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    build({ EVOLUTION_SYSTEM_APIKEY: undefined }).onApplicationBootstrap();

    expect(JSON.stringify(warn.mock.calls)).toContain('EVOLUTION_SYSTEM_APIKEY');
  });
});
