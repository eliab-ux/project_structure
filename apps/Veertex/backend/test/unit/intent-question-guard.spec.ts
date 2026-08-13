import 'reflect-metadata';
import axios from 'axios';
import { DeterministicIntentParser } from '../../src/infrastructure/intent/deterministic-intent-parser';
import { GeminiIntentParser } from '../../src/infrastructure/intent/gemini-intent-parser';
import { INTENT_COMMAND_NAMES } from '../../src/contexts/intent/domain/intent-command';
import { looksLikeQuestion } from '../../src/contexts/intent/domain/question-detection';

/**
 * **Frase interrogativa nunca produz comando de escrita — nos DOIS tradutores.**
 *
 * O defeito que originou esta suíte (Eliab, 13/08/2026): o gatilho `'pode '` do tradutor por
 * palavra-chave transformava *"quem pode dar desconto"* em `SetRolePermissions`. Quem perguntava
 * recebia um rascunho de ALTERAÇÃO de papel, e aprovar sem ler mudava permissão por ter perguntado.
 *
 * Por que os dois adapters no mesmo arquivo, com a MESMA tabela de frases: medido contra a API real
 * naquele dia, o Gemini classificava as quatro interrogativas corretamente e o determinístico errava
 * as quatro. Um adapter de teste mais permissivo que o de produção mente sobre o sistema — e é o
 * determinístico que as outras suítes usam. A tabela compartilhada é o que impede a divergência de
 * voltar sem ninguém notar.
 *
 * O adapter do Gemini é exercitado com HTTP **mockado devolvendo o comando de escrita**: é a única
 * forma de provar que a recusa vem da GUARDA DE CÓDIGO e não da obediência do modelo. Um teste que
 * chamasse a API de verdade provaria o contrário do que interessa — que hoje o modelo obedeceu.
 */

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

/** Interrogativas que casam com gatilho de escrita — todas devem ser recusadas. */
const QUESTIONS = [
  'quem pode dar desconto',
  'a Ana pode dar desconto?',
  'por que a Ana pode dar desconto',
  'quais permissões o supervisor tem?',
  'quem pode criar empresa',
  'como cadastrar empresa',
  'o que o vendedor pode alterar usuário',
  'quando criar papel novo?',
];

/** Imperativas legítimas — o controle. Recusar estas seria o defeito oposto, e também caro. */
const COMMANDS: { text: string; expected: string }[] = [
  { text: 'criar papel de supervisor', expected: 'CreateRole' },
  { text: 'cadastrar empresa', expected: 'CreateCompany' },
  { text: 'criar usuário para o financeiro', expected: 'InviteUser' },
  { text: 'ativar módulo VND', expected: 'ToggleModule' },
  { text: 'trocar o papel do João', expected: 'AssignRole' },
  { text: 'o supervisor não pode dar desconto', expected: 'SetRolePermissions' },
];

describe('looksLikeQuestion', () => {
  it.each(QUESTIONS)('reconhece "%s" como pergunta', (text) => {
    expect(looksLikeQuestion(text)).toBe(true);
  });

  it.each(COMMANDS.map((c) => c.text))('não trata "%s" como pergunta', (text) => {
    expect(looksLikeQuestion(text)).toBe(false);
  });

  it('não confunde marcador no meio da frase com pergunta', () => {
    // "que" no meio é oração relativa, não interrogação. Recusar isto tiraria da Mesa a forma mais
    // natural de descrever uma empresa.
    expect(looksLikeQuestion('cadastrar empresa que vende tinta')).toBe(false);
  });

  it('documenta o limite conhecido: pergunta sem "?" e sem marcador inicial não é detectada', () => {
    // Não é um comportamento desejado — é o preço de decidir por FORMA. Está aqui para que uma
    // mudança futura na função apareça como falha deliberada, e não como surpresa.
    expect(looksLikeQuestion('quero saber quem pode dar desconto')).toBe(false);
  });
});

describe('DeterministicIntentParser — pergunta nunca vira escrita', () => {
  const parser = new DeterministicIntentParser();

  it.each(QUESTIONS)('recusa "%s"', async (text) => {
    const result = await parser.parse({ text, availableCommands: INTENT_COMMAND_NAMES });

    expect(result.command).toBeNull();
    // Não basta recusar: a recusa precisa dizer POR QUE, senão o operador repete a pergunta com
    // outras palavras até acertar um gatilho de escrita.
    expect(result.command === null && result.guess).toContain('consulta');
  });

  it.each(COMMANDS)('ainda reconhece "$text" como $expected', async ({ text, expected }) => {
    const result = await parser.parse({ text, availableCommands: INTENT_COMMAND_NAMES });

    expect(result.command).toBe(expected);
  });
});

describe('GeminiIntentParser — pergunta nunca vira escrita, mesmo se o modelo propuser', () => {
  const config = {
    get: (key: string) =>
      ({
        GEMINI_API_KEY: 'chave-de-teste',
        GEMINI_MODEL: 'gemini-2.5-flash',
        GEMINI_API_URL: 'https://exemplo.invalido/v1beta',
      })[key],
  } as never;

  /** Responde SEMPRE com um comando de escrita, seja qual for a frase — o pior caso do modelo. */
  function mockModelAnswering(command: string) {
    const post = jest.fn().mockResolvedValue({
      data: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    command,
                    confidence: 0.98,
                    fields: { roleId: { value: 'papel-x', origin: 'ditado', review: false } },
                    unresolved: [],
                  }),
                },
              ],
            },
          },
        ],
      },
    });
    mockedAxios.create.mockReturnValue({ post } as never);
    return post;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(QUESTIONS)(
    'descarta o SetRolePermissions que o modelo propôs para "%s"',
    async (text) => {
      const post = mockModelAnswering('SetRolePermissions');
      const parser = new GeminiIntentParser(config);

      const result = await parser.parse({ text, availableCommands: INTENT_COMMAND_NAMES });

      // A chamada ACONTECEU e veio um comando de escrita: a recusa é da guarda, não do modelo.
      expect(post).toHaveBeenCalledTimes(1);
      expect(result.command).toBeNull();
      expect(result.command === null && result.guess).toContain('consulta');
    },
  );

  it('mantém o comando quando a frase é imperativa', async () => {
    mockModelAnswering('CreateRole');
    const parser = new GeminiIntentParser(config);

    const result = await parser.parse({
      text: 'criar papel de supervisor',
      availableCommands: INTENT_COMMAND_NAMES,
    });

    expect(result.command).toBe('CreateRole');
  });

  it('manda a frase do operador em contents e as regras em systemInstruction', async () => {
    const post = mockModelAnswering('CreateRole');
    const parser = new GeminiIntentParser(config);

    await parser.parse({
      text: 'criar papel de supervisor',
      availableCommands: INTENT_COMMAND_NAMES,
    });

    const body = post.mock.calls[0][1] as {
      systemInstruction: { parts: { text: string }[] };
      contents: { parts: { text: string }[] }[];
    };
    // A separação é a defesa contra injeção pelo texto do operador: o dado dele não pode chegar no
    // mesmo campo em que as regras chegam.
    expect(body.contents[0].parts[0].text).toBe('criar papel de supervisor');
    expect(body.systemInstruction.parts[0].text).not.toContain('criar papel de supervisor');
    // A proibição explícita da regra 6 tem de estar na instrução, não só na guarda de código.
    expect(body.systemInstruction.parts[0].text).toContain('PERGUNTA NUNCA VIRA COMANDO');
  });
});
