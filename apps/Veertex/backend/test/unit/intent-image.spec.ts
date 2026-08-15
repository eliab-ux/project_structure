import 'reflect-metadata';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { GeminiIntentParser } from '../../src/infrastructure/intent/gemini-intent-parser';
import { DeterministicIntentParser } from '../../src/infrastructure/intent/deterministic-intent-parser';
import { ParseIntentUseCase } from '../../src/contexts/intent/application/use-cases/parse-intent/parse-intent.use-case';
import { ParseIntentCommand } from '../../src/contexts/intent/application/use-cases/parse-intent/parse-intent.use-case';
import { AuthorizeIntentCommandUseCase } from '../../src/contexts/intent/application/use-cases/authorize-intent-command/authorize-intent-command.use-case';
import {
  ImageNoticeRequiredException,
  IntentChannelUnavailableException,
} from '../../src/contexts/intent/domain/intent-exceptions';
import { INTENT_COMMAND_NAMES } from '../../src/contexts/intent/domain/intent-command';
import { isSupported } from '../../src/contexts/intent/domain/intent-command';

/**
 * ENTRADA POR IMAGEM — o que este arquivo prende é o que protege o titular do documento e o
 * operador, e nenhuma das duas coisas depende de o modelo colaborar.
 *
 *  - a imagem vai como `inline_data`, no mesmo turno do texto;
 *  - **todo campo lido de imagem volta `origin: 'externo'` e `review: true`, IMPOSTO** — mesmo que o
 *    modelo devolva "ditado" e `review: false`. É o §6.1 (fonte externa distinguível) e o §7
 *    (revisão humana) virando dado, em vez de pedido no prompt;
 *  - **sem o registro do aviso, a rota recusa** — é o que impede a tela de "esquecer" de exibi-lo;
 *  - o adapter que não lê imagem **recusa em voz alta**, nunca ignora o anexo.
 */

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const IMAGEM = Buffer.from('imagem-de-mentira').toString('base64');

const config = {
  get: (chave: string) =>
    ({
      GEMINI_API_KEY: 'chave-de-teste',
      GEMINI_MODEL: 'gemini-2.5-flash',
      GEMINI_API_URL: 'https://exemplo.invalido/v1beta',
    })[chave],
} as unknown as ConfigService;

function mockModelo(resposta: unknown) {
  const post = jest.fn().mockResolvedValue({
    data: { candidates: [{ content: { parts: [{ text: JSON.stringify(resposta) }] } }] },
  });
  mockedAxios.create.mockReturnValue({ post } as never);
  return post;
}

describe('GeminiIntentParser — imagem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('manda a imagem como inline_data, no MESMO turno do texto', async () => {
    const post = mockModelo({ command: 'CreateContact', confidence: 0.9, fields: {} });
    const parser = new GeminiIntentParser(config);

    await parser.parse({
      text: 'cadastrar este cliente',
      availableCommands: INTENT_COMMAND_NAMES,
      attachment: { mimeType: 'image/jpeg', dataBase64: IMAGEM },
    });

    const body = post.mock.calls[0][1] as {
      contents: {
        parts: ({ inline_data?: { mime_type: string; data: string } } & { text?: string })[];
      }[];
    };
    const partes = body.contents[0].parts;
    const anexo = partes.find((p) => p.inline_data)?.inline_data;
    expect(anexo?.mime_type).toBe('image/jpeg');
    expect(anexo?.data).toBe(IMAGEM);
    // O texto do operador continua no mesmo turno: a foto e o pedido são uma coisa só.
    expect(partes.find((p) => p.text)?.text).toBe('cadastrar este cliente');
  });

  it('IMPÕE origin "externo" e review true, mesmo o modelo dizendo o contrário', async () => {
    mockModelo({
      command: 'CreateContact',
      confidence: 0.99,
      fields: {
        // O pior caso: o modelo afirma que o operador ditou, e que não precisa revisão.
        legalName: { value: 'Maria Souza', origin: 'ditado', review: false },
        document: { value: '12345678901', origin: 'ditado', review: false },
      },
    });
    const parser = new GeminiIntentParser(config);

    const resultado = await parser.parse({
      text: 'cadastrar este cliente',
      availableCommands: INTENT_COMMAND_NAMES,
      attachment: { mimeType: 'image/jpeg', dataBase64: IMAGEM },
    });

    expect(isSupported(resultado)).toBe(true);
    if (!isSupported(resultado)) return;

    for (const campo of Object.values(resultado.fields)) {
      expect(campo.origin).toBe('externo');
      expect(campo.review).toBe(true);
    }
  });

  it('SEM imagem, a procedência do modelo é preservada — a imposição é só do caminho da foto', async () => {
    mockModelo({
      command: 'CreateContact',
      confidence: 0.9,
      fields: { legalName: { value: 'Maria', origin: 'ditado', review: false } },
    });
    const parser = new GeminiIntentParser(config);

    const resultado = await parser.parse({
      text: 'cadastrar cliente Maria',
      availableCommands: INTENT_COMMAND_NAMES,
    });

    if (!isSupported(resultado)) throw new Error('deveria reconhecer');
    expect(resultado.fields.legalName.origin).toBe('ditado');
    expect(resultado.fields.legalName.review).toBe(false);
  });

  it('a instrução ganha as regras da imagem — sem palpite em dígito ilegível', async () => {
    const post = mockModelo({ command: 'CreateContact', confidence: 0.9, fields: {} });
    const parser = new GeminiIntentParser(config);

    await parser.parse({
      text: 'cadastrar este cliente',
      availableCommands: INTENT_COMMAND_NAMES,
      attachment: { mimeType: 'image/png', dataBase64: IMAGEM },
    });

    const instrucao = (
      post.mock.calls[0][1] as { systemInstruction: { parts: { text: string }[] } }
    ).systemInstruction.parts[0].text;
    expect(instrucao).toContain('HÁ UMA IMAGEM');
    expect(instrucao).toContain('CPF ilegível é campo em branco, nunca um palpite');
  });

  it('declara que sabe ler imagem', () => {
    expect(new GeminiIntentParser(config).supportsAttachment).toBe(true);
  });
});

describe('DeterministicIntentParser — imagem', () => {
  it('RECUSA o anexo em voz alta, nunca ignora', async () => {
    const parser = new DeterministicIntentParser();

    await expect(
      parser.parse({
        text: 'cadastrar este cliente',
        availableCommands: INTENT_COMMAND_NAMES,
        attachment: { mimeType: 'image/jpeg', dataBase64: IMAGEM },
      }),
    ).rejects.toBeInstanceOf(IntentChannelUnavailableException);
  });

  it('declara que NÃO sabe ler imagem', () => {
    expect(new DeterministicIntentParser().supportsAttachment).toBe(false);
  });
});

describe('ParseIntentUseCase — o aviso ao titular', () => {
  const parserFalso = {
    supportsAttachment: true,
    ensureAvailable: jest.fn(),
    parse: jest.fn().mockResolvedValue({ command: null, guess: null, screenHint: null }),
  };
  const autorizar = {
    availableFor: () => INTENT_COMMAND_NAMES,
  } as unknown as AuthorizeIntentCommandUseCase;

  beforeEach(() => jest.clearAllMocks());

  it('RECUSA imagem sem o registro de que o aviso foi exibido', async () => {
    const useCase = new ParseIntentUseCase(parserFalso, autorizar);

    await expect(
      useCase.execute(
        new ParseIntentCommand('cadastrar este cliente', ['*'], [], {
          mimeType: 'image/jpeg',
          dataBase64: IMAGEM,
        }),
      ),
    ).rejects.toBeInstanceOf(ImageNoticeRequiredException);

    // E recusa ANTES de gastar uma chamada paga no provedor.
    expect(parserFalso.parse).not.toHaveBeenCalled();
  });

  it('com o aviso registrado, segue e repassa a imagem ao tradutor', async () => {
    const useCase = new ParseIntentUseCase(parserFalso, autorizar);

    await useCase.execute(
      new ParseIntentCommand(
        'cadastrar este cliente',
        ['*'],
        [],
        { mimeType: 'image/jpeg', dataBase64: IMAGEM },
        '2026-08-15T12:00:00.000Z',
        'user-1',
        'conta-1',
      ),
    );

    expect(parserFalso.parse).toHaveBeenCalledWith(
      expect.objectContaining({ attachment: { mimeType: 'image/jpeg', dataBase64: IMAGEM } }),
    );
  });

  it('sem imagem, o aviso não é exigido', async () => {
    const useCase = new ParseIntentUseCase(parserFalso, autorizar);

    await expect(
      useCase.execute(new ParseIntentCommand('criar papel de supervisor', ['*'], [])),
    ).resolves.toBeDefined();
  });
});
