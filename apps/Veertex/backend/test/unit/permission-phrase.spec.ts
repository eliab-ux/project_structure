import 'reflect-metadata';
import axios from 'axios';
import {
  completeWithUndecided,
  splitPhraseIntoLines,
  UNDECIDED_REASON,
} from '../../src/contexts/role/domain/permission-phrase';
import { ALL_PERMISSIONS } from '../../src/contexts/role/domain/permissions.catalog';
import { DeterministicPermissionPhraseTranslator } from '../../src/infrastructure/intent/deterministic-permission-phrase-translator';
import { GeminiPermissionPhraseTranslator } from '../../src/infrastructure/intent/gemini-permission-phrase-translator';

/**
 * FRASE → PERMISSÕES (§5.1). O que estes testes prendem é a regra do "a decidir".
 *
 * > `reports.export → a decidir → "sua frase não disse — não vou supor"`
 *
 * O silêncio da frase não pode resolver como permitido (inventa poder que ninguém concedeu) nem
 * como negado (tira poder que ninguém quis tirar, e só se descobre quando alguém não consegue
 * trabalhar). Por isso a completude do catálogo é testada como INVARIANTE, e não como caso: toda
 * permissão que existe aparece na leitura, sempre.
 */

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('completeWithUndecided — o silêncio nunca vira decisão', () => {
  it('devolve UMA entrada por permissão do catálogo, mesmo com o tradutor calado', () => {
    const reading = completeWithUndecided([]);

    expect(reading).toHaveLength(ALL_PERMISSIONS.length);
    expect(reading.map((v) => v.permission).sort()).toEqual([...ALL_PERMISSIONS].sort());
    expect(reading.every((v) => v.decision === 'undecided')).toBe(true);
    expect(reading.every((v) => v.quote === null)).toBe(true);
    expect(reading[0].reason).toBe(UNDECIDED_REASON);
  });

  it('preserva o que o tradutor decidiu COM trecho de evidência', () => {
    const reading = completeWithUndecided([
      {
        permission: 'companies.read',
        decision: 'granted',
        quote: 'pode ver as empresas',
        reason: 'A linha concede leitura.',
      },
    ]);

    const granted = reading.find((v) => v.permission === 'companies.read');
    expect(granted?.decision).toBe('granted');
    expect(granted?.quote).toBe('pode ver as empresas');
    // E o resto do catálogo continua indeciso — decidir uma não decide as vizinhas.
    expect(reading.filter((v) => v.decision === 'undecided').length).toBe(
      ALL_PERMISSIONS.length - 1,
    );
  });

  it('REBAIXA para "a decidir" o veredito sem trecho — decisão sem origem não se sustenta', () => {
    const reading = completeWithUndecided([
      {
        permission: 'companies.delete',
        decision: 'denied',
        quote: null,
        reason: 'achei que sim',
      },
    ]);

    const target = reading.find((v) => v.permission === 'companies.delete');
    expect(target?.decision).toBe('undecided');
    expect(target?.reason).toBe(UNDECIDED_REASON);
  });

  it('descarta permissão que não existe no catálogo', () => {
    const reading = completeWithUndecided([
      {
        permission: 'contacts.super_edit',
        decision: 'granted',
        quote: 'pode tudo de contatos',
        reason: 'inventada pelo modelo',
      },
    ]);

    expect(reading.some((v) => v.permission === 'contacts.super_edit')).toBe(false);
    expect(reading).toHaveLength(ALL_PERMISSIONS.length);
  });
});

describe('splitPhraseIntoLines', () => {
  it('separa a concessão da restrição no "mas" — é onde o sentido inverte', () => {
    expect(splitPhraseIntoLines('A Ana pode ver empresas, mas não pode excluir empresa')).toEqual([
      'A Ana pode ver empresas,',
      'não pode excluir empresa',
    ]);
  });

  it('quebra por ponto e por ponto-e-vírgula', () => {
    expect(
      splitPhraseIntoLines('Pode ver usuários. Pode criar usuário; não pode excluir.'),
    ).toEqual(['Pode ver usuários', 'Pode criar usuário', 'não pode excluir']);
  });
});

describe('DeterministicPermissionPhraseTranslator', () => {
  const translator = new DeterministicPermissionPhraseTranslator();

  const read = async (phrase: string) => {
    const lines = splitPhraseIntoLines(phrase);
    const verdicts = await translator.translate({ phrase, lines, catalogue: ALL_PERMISSIONS });
    return completeWithUndecided(verdicts);
  };

  it('concede e nega na MESMA frase, cada um pela sua linha', async () => {
    const reading = await read('pode ver empresas, mas não pode excluir empresa');

    expect(reading.find((v) => v.permission === 'companies.read')?.decision).toBe('granted');
    expect(reading.find((v) => v.permission === 'companies.delete')?.decision).toBe('denied');
    // Criar e alterar não foram ditos: continuam a decidir, e não herdam o "pode ver".
    expect(reading.find((v) => v.permission === 'companies.create')?.decision).toBe('undecided');
    expect(reading.find((v) => v.permission === 'companies.update')?.decision).toBe('undecided');
  });

  it('não deixa uma área decidir a outra', async () => {
    const reading = await read('pode ver empresas');

    expect(
      reading
        .filter((v) => v.permission.startsWith('users.'))
        .every((v) => v.decision === 'undecided'),
    ).toBe(true);
    expect(
      reading
        .filter((v) => v.permission.startsWith('roles.'))
        .every((v) => v.decision === 'undecided'),
    ).toBe(true);
  });

  it('cita a LINHA literal como evidência, nunca uma paráfrase', async () => {
    const reading = await read('pode ver empresas');

    expect(reading.find((v) => v.permission === 'companies.read')?.quote).toBe('pode ver empresas');
  });

  it('frase sem área conhecida não decide nada — tudo a decidir', async () => {
    const reading = await read('a Ana é uma ótima vendedora');

    expect(reading.every((v) => v.decision === 'undecided')).toBe(true);
  });
});

describe('GeminiPermissionPhraseTranslator — não confia na saída do modelo', () => {
  const config = {
    get: (key: string) =>
      ({
        GEMINI_API_KEY: 'chave-de-teste',
        GEMINI_MODEL: 'gemini-2.5-flash',
        GEMINI_API_URL: 'https://exemplo.invalido/v1beta',
      })[key],
  } as never;

  function mockModel(verdicts: unknown) {
    const post = jest.fn().mockResolvedValue({
      data: {
        candidates: [{ content: { parts: [{ text: JSON.stringify({ verdicts }) }] } }],
      },
    });
    mockedAxios.create.mockReturnValue({ post } as never);
    return post;
  }

  beforeEach(() => jest.clearAllMocks());

  const phrase = 'a Ana pode ver empresas';

  it('DESCARTA o trecho que não existe na frase — citação inventada não vira evidência', async () => {
    mockModel([
      {
        permission: 'companies.delete',
        decision: 'granted',
        quote: 'a Ana pode apagar tudo',
        reason: 'inventado',
      },
    ]);
    const translator = new GeminiPermissionPhraseTranslator(config);

    const verdicts = await translator.translate({
      phrase,
      lines: [phrase],
      catalogue: ALL_PERMISSIONS,
    });

    // O veredito volta sem trecho, e o domínio o rebaixa para "a decidir".
    expect(verdicts[0].quote).toBeNull();
    const reading = completeWithUndecided(verdicts);
    expect(reading.find((v) => v.permission === 'companies.delete')?.decision).toBe('undecided');
  });

  it('ANCORA o trecho condensado na linha do usuário — o caso real de 13/08/2026', async () => {
    // Frase real: "pode ver e cadastrar empresas, mas não pode excluir empresa".
    // O modelo devolveu «pode ver empresas» para companies.read — correto em sentido, não contíguo,
    // porque elidiu o "e cadastrar". A guarda literal rebaixava isto para "a decidir", e obrigava o
    // operador a decidir à mão o que a frase concedia em letras.
    const real = 'pode ver e cadastrar empresas, mas não pode excluir empresa';
    mockModel([
      {
        permission: 'companies.read',
        decision: 'granted',
        quote: 'pode ver empresas',
        reason: 'a frase concede leitura',
      },
    ]);
    const translator = new GeminiPermissionPhraseTranslator(config);

    const verdicts = await translator.translate({
      phrase: real,
      lines: splitPhraseIntoLines(real),
      catalogue: ALL_PERMISSIONS,
    });

    expect(verdicts[0].decision).toBe('granted');
    // E o que a tela mostra é a LINHA DO USUÁRIO, não a paráfrase do modelo.
    expect(verdicts[0].quote).toBe('pode ver e cadastrar empresas,');
  });

  it('NÃO deixa o modelo inverter concessão em negação — a ordem das palavras protege', async () => {
    const real = 'pode ver e cadastrar empresas, mas não pode excluir empresa';
    mockModel([
      {
        permission: 'companies.read',
        decision: 'denied',
        // Todas as palavras existem na frase; a ORDEM não. "não" só aparece depois de "ver".
        quote: 'não pode ver empresas',
        reason: 'inversão que a frase não autoriza',
      },
    ]);
    const translator = new GeminiPermissionPhraseTranslator(config);

    const verdicts = await translator.translate({
      phrase: real,
      lines: splitPhraseIntoLines(real),
      catalogue: ALL_PERMISSIONS,
    });

    expect(verdicts[0].quote).toBeNull();
    expect(
      completeWithUndecided(verdicts).find((v) => v.permission === 'companies.read')?.decision,
    ).toBe('undecided');
  });

  it('aceita o trecho que existe literalmente', async () => {
    mockModel([
      {
        permission: 'companies.read',
        decision: 'granted',
        quote: 'pode ver empresas',
        reason: 'a frase concede leitura',
      },
    ]);
    const translator = new GeminiPermissionPhraseTranslator(config);

    const verdicts = await translator.translate({
      phrase,
      lines: [phrase],
      catalogue: ALL_PERMISSIONS,
    });

    expect(verdicts).toHaveLength(1);
    expect(verdicts[0]).toMatchObject({ permission: 'companies.read', decision: 'granted' });
  });

  it('ignora "undecided" vindo do modelo — o silêncio é decidido no domínio, não pelo tradutor', async () => {
    mockModel([{ permission: 'users.read', decision: 'undecided', quote: 'ver empresas' }]);
    const translator = new GeminiPermissionPhraseTranslator(config);

    const verdicts = await translator.translate({
      phrase,
      lines: [phrase],
      catalogue: ALL_PERMISSIONS,
    });

    expect(verdicts).toHaveLength(0);
  });

  it('manda a frase em contents e as regras em systemInstruction', async () => {
    const post = mockModel([]);
    const translator = new GeminiPermissionPhraseTranslator(config);

    await translator.translate({ phrase, lines: [phrase], catalogue: ALL_PERMISSIONS });

    const body = post.mock.calls[0][1] as {
      systemInstruction: { parts: { text: string }[] };
      contents: { parts: { text: string }[] }[];
    };
    expect(body.contents[0].parts[0].text).toBe(phrase);
    expect(body.systemInstruction.parts[0].text).not.toContain(phrase);
    // O catálogo fechado vai na instrução: o modelo não pode propor permissão que não existe.
    expect(body.systemInstruction.parts[0].text).toContain('companies.read');
  });
});
