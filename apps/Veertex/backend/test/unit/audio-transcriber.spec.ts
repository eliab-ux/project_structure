import 'reflect-metadata';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { ConfigService } from '@nestjs/config';
import { GeminiAudioTranscriber } from '../../src/infrastructure/intent/gemini-audio-transcriber';
import { TranscribeAudioUseCase } from '../../src/contexts/intent/application/use-cases/transcribe-audio/transcribe-audio.use-case';
import { AudioTranscriptionDisabledException } from '../../src/contexts/intent/domain/intent-exceptions';
import { IntentChannelUnavailableException } from '../../src/contexts/intent/domain/intent-exceptions';

/**
 * TRANSCRIÇÃO DE ÁUDIO — verificada contra um **servidor de mentira**, como o adapter do Evolution.
 *
 * O que este arquivo prende não é "o Gemini transcreve bem" — isso depende do modelo e se mede
 * falando. O que ele prende é o que ESTÁ SOB NOSSO CONTROLE e quebraria em silêncio:
 *
 *  - o áudio sai como `inline_data` com o mime que veio, e não como texto ou anexo inventado;
 *  - a instrução proíbe reescrever e **proíbe remover negação** — a regra que impede a inversão de
 *    uma permissão. Um refactor que "melhorasse" o prompt e derrubasse essa linha passaria por todos
 *    os outros testes;
 *  - `temperature: 0`, porque criatividade num transcritor é defeito;
 *  - a chave vai no HEADER, nunca na query string;
 *  - resposta vazia é FALHA, não string vazia — quem chamou mantém o áudio e retenta;
 *  - a flag desligada recusa ANTES de qualquer chamada externa.
 */

const AUDIO_FALSO = Buffer.from('audio-de-mentira-para-o-teste').toString('base64');

interface Recebido {
  headers: Record<string, string | string[] | undefined>;
  body: {
    systemInstruction: { parts: { text: string }[] };
    contents: {
      parts: ({ inline_data?: { mime_type: string; data: string } } & { text?: string })[];
    }[];
    generationConfig: { temperature: number };
  };
  url: string;
}

describe('GeminiAudioTranscriber', () => {
  let server: Server;
  let baseUrl: string;
  let recebido: Recebido | null;
  let responder: () => { status: number; body: unknown };

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        recebido = { headers: req.headers, body: JSON.parse(raw), url: req.url ?? '' };
        const resposta = responder();
        res.writeHead(resposta.status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(resposta.body));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    recebido = null;
    responder = () => ({
      status: 200,
      body: {
        candidates: [{ content: { parts: [{ text: 'pode vender mas não pode dar desconto' }] } }],
      },
    });
  });

  const construir = () =>
    new GeminiAudioTranscriber({
      get: (chave: string) =>
        ({
          GEMINI_API_KEY: 'chave-de-teste',
          GEMINI_MODEL: 'gemini-2.5-flash',
          GEMINI_API_URL: baseUrl,
        })[chave],
    } as unknown as ConfigService);

  it('manda o áudio como inline_data, com o mime que recebeu', async () => {
    await construir().transcribe({ dataBase64: AUDIO_FALSO, mimeType: 'audio/webm;codecs=opus' });

    const partes = recebido!.body.contents[0].parts;
    const anexo = partes.find((p) => p.inline_data)?.inline_data;
    expect(anexo?.mime_type).toBe('audio/webm;codecs=opus');
    expect(anexo?.data).toBe(AUDIO_FALSO);
  });

  it('a instrução PROÍBE remover negação — a regra que impede inverter uma permissão', async () => {
    await construir().transcribe({ dataBase64: AUDIO_FALSO, mimeType: 'audio/webm' });

    const instrucao = recebido!.body.systemInstruction.parts[0].text;
    expect(instrucao).toContain('NUNCA remova, mova ou suavize uma negação');
    // E o exemplo concreto: é ele que ensina o modelo qual é o erro.
    expect(instrucao).toContain('pode vender mas não pode dar desconto');
    expect(instrucao).toContain('LITERAL');
    expect(instrucao).toContain('NÃO corrija gramática');
  });

  it('usa temperature 0 — transcritor criativo é transcritor errado', async () => {
    await construir().transcribe({ dataBase64: AUDIO_FALSO, mimeType: 'audio/webm' });

    expect(recebido!.body.generationConfig.temperature).toBe(0);
  });

  it('manda a chave no HEADER, nunca na URL', async () => {
    await construir().transcribe({ dataBase64: AUDIO_FALSO, mimeType: 'audio/webm' });

    expect(recebido!.headers['x-goog-api-key']).toBe('chave-de-teste');
    // URL aparece em log de proxy, em histórico e em mensagem de erro de biblioteca.
    expect(recebido!.url).not.toContain('chave-de-teste');
  });

  it('devolve a transcrição sem alterá-la', async () => {
    const texto = await construir().transcribe({ dataBase64: AUDIO_FALSO, mimeType: 'audio/webm' });

    expect(texto).toBe('pode vender mas não pode dar desconto');
  });

  it('resposta VAZIA é falha, não string vazia', async () => {
    responder = () => ({
      status: 200,
      body: { candidates: [{ content: { parts: [{ text: '  ' }] } }] },
    });

    // Falhar aqui é o que faz o frontend GUARDAR o áudio e oferecer retentar. Devolver "" faria a
    // tela apagar o que a pessoa falou e mostrar um campo vazio, como se ela não tivesse falado.
    await expect(
      construir().transcribe({ dataBase64: AUDIO_FALSO, mimeType: 'audio/webm' }),
    ).rejects.toBeInstanceOf(IntentChannelUnavailableException);
  });

  it('erro do provedor vira falha de canal, sem vazar o corpo', async () => {
    responder = () => ({ status: 500, body: { error: { message: 'boom' } } });

    await expect(
      construir().transcribe({ dataBase64: AUDIO_FALSO, mimeType: 'audio/webm' }),
    ).rejects.toBeInstanceOf(IntentChannelUnavailableException);
  });

  it('sem chave, recusa ANTES de chamar', async () => {
    const semChave = new GeminiAudioTranscriber({
      get: () => undefined,
    } as unknown as ConfigService);

    expect(() => semChave.ensureAvailable()).toThrow(IntentChannelUnavailableException);
    expect(recebido).toBeNull();
  });
});

describe('TranscribeAudioUseCase — a flag', () => {
  const comFlag = (valor: string | undefined) =>
    new TranscribeAudioUseCase(
      { ensureAvailable: jest.fn(), transcribe: jest.fn().mockResolvedValue('texto') },
      { get: () => valor } as unknown as ConfigService,
    );

  it('DESLIGADA por padrão: recusa sem tocar no provedor', async () => {
    const useCase = comFlag(undefined);

    await expect(
      useCase.execute({ dataBase64: 'x', mimeType: 'audio/webm' }),
    ).rejects.toBeInstanceOf(AudioTranscriptionDisabledException);
    expect(useCase.isEnabled()).toBe(false);
  });

  it('só "true" liga — qualquer outro valor mantém desligado', async () => {
    expect(comFlag('1').isEnabled()).toBe(false);
    expect(comFlag('yes').isEnabled()).toBe(false);
    expect(comFlag('true').isEnabled()).toBe(true);
  });

  it('ligada, delega ao transcritor', async () => {
    const useCase = comFlag('true');

    await expect(useCase.execute({ dataBase64: 'x', mimeType: 'audio/webm' })).resolves.toBe(
      'texto',
    );
  });
});
