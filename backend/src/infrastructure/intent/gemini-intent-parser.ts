import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  IntentParseRequest,
  IntentParserPort,
} from '../../contexts/intent/application/ports/output/intent-parser.port';
import {
  INTENT_COMMANDS,
  IntentCommandName,
  IntentResult,
  isKnownIntentCommand,
} from '../../contexts/intent/domain/intent-command';
import { IntentChannelUnavailableException } from '../../contexts/intent/domain/intent-exceptions';

/**
 * Tradução de intenção pelo Gemini, por **HTTP puro, sem SDK**.
 *
 * Sem SDK por decisão de 12/08/2026: adapter sem SDK é mais fácil de trocar, que é o ponto de existir
 * um port. Um SDK traz o vocabulário do fornecedor para dentro do código e faz a troca de provedor
 * virar reescrita — exatamente o que a Visão Geral §2.6 proíbe ("nenhum `if (provedor === ...)` fora
 * de adapter"). Usa `axios`, que já é dependência do backend (o gateway do Evolution usa), com o mesmo
 * padrão de timeout.
 *
 * **Nunca cai para o adapter determinístico.** Se a chave faltar ou a chamada falhar, recusa. Cair
 * para o determinístico devolveria comando enlatado por palavra-chave e o chamaria de tradução: o
 * usuário aprovaria uma ação que o texto dele não pedia, e a procedência mentiria dizendo "ditado".
 * Falhar fechado aqui custa uma mensagem de erro; falhar aberto custa uma escrita errada aprovada por
 * um humano que confiou na tela.
 *
 * **O texto do operador não vai para log.** É dado de negócio do cliente, e um log de intenções é um
 * registro de tudo o que se tentou fazer na conta. Só o resultado estrutural (comando reconhecido,
 * quantos campos ficaram em revisão) é registrado.
 */
@Injectable()
export class GeminiIntentParser implements IntentParserPort {
  private readonly logger = new Logger(GeminiIntentParser.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      // 15s: acima disso o operador já desistiu da tela, e a requisição está segurando uma conexão.
      timeout: 15_000,
    });
  }

  ensureAvailable(): void {
    if (!this.baseUrl() || !this.apiKey() || !this.model()) {
      this.logger.error(
        'Canal de tradução de intenção indisponível: GEMINI_API_URL, GEMINI_API_KEY ou ' +
          'GEMINI_MODEL ausente no ambiente.',
      );
      throw new IntentChannelUnavailableException();
    }
  }

  async parse(request: IntentParseRequest): Promise<IntentResult> {
    this.ensureAvailable();

    const url = `${this.baseUrl()}/models/${this.model()}:generateContent`;

    let raw: unknown;
    try {
      const response = await this.http.post(
        url,
        {
          contents: [{ role: 'user', parts: [{ text: this.buildPrompt(request) }] }],
          generationConfig: {
            // Determinismo tão alto quanto o provedor permite: a mesma frase deve produzir o mesmo
            // comando. Criatividade aqui é defeito, não recurso.
            temperature: 0,
            // Saída JSON obrigatória pelo próprio provedor. É a primeira barreira; a segunda é a
            // validação abaixo, porque schema do fornecedor não é garantia que se possa confiar.
            responseMimeType: 'application/json',
          },
        },
        // A chave vai no HEADER, não na query string: URL aparece em log de proxy, em histórico e em
        // mensagem de erro de biblioteca.
        { headers: { 'x-goog-api-key': this.apiKey() as string } },
      );

      const text = (
        response.data as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      )?.candidates?.[0]?.content?.parts?.[0]?.text;

      raw = text ? JSON.parse(text) : null;
    } catch (error) {
      // Sem o texto do operador e sem o corpo da resposta no log: o corpo pode ecoar o texto enviado.
      this.logger.error('Falha ao traduzir intenção', {
        reason: (error as Error)?.name ?? 'unknown',
      });
      throw new IntentChannelUnavailableException();
    }

    return this.validate(raw, request.availableCommands);
  }

  /**
   * Valida a resposta contra a forma esperada e **descarta tudo que não reconhece**.
   *
   * Nunca confie na saída do modelo (CLAUDE.md, Princípio 2 — todo dado de fora é potencialmente
   * malicioso, e a saída de um LLM é dado de fora). Em particular:
   *
   *  - comando fora do catálogo → tratado como "não sei fazer isso", nunca repassado adiante;
   *  - comando que a conta não pode receber → idem, porque módulo inativo nunca é proposto (§3);
   *  - campo sem `origin` → recebe `review: true`, jamais é aceito como resolvido;
   *  - `confidence` fora de [0,1] → normalizada, nunca propagada.
   */
  private validate(raw: unknown, available: IntentCommandName[]): IntentResult {
    const body = (raw ?? {}) as Record<string, unknown>;
    const command = typeof body.command === 'string' ? body.command : null;

    if (!command || !isKnownIntentCommand(command) || !available.includes(command)) {
      this.logger.log('Intenção fora do catálogo disponível', {
        reconhecido: false,
      });
      return {
        command: null,
        guess: typeof body.guess === 'string' ? body.guess.slice(0, 200) : null,
        screenHint: null,
      };
    }

    const rawFields = (body.fields ?? {}) as Record<string, unknown>;
    const fields = Object.fromEntries(
      Object.entries(rawFields).map(([name, value]) => {
        const field = (value ?? {}) as Record<string, unknown>;
        const hasOrigin = typeof field.origin === 'string' && field.origin !== '';
        return [
          name,
          {
            value: field.value ?? null,
            origin: hasOrigin ? (field.origin as 'ditado') : null,
            // Sem procedência ou sem valor, o campo PRECISA de decisão humana. Aceitar um valor cuja
            // origem o modelo não soube declarar é o caminho mais curto para uma aprovação cega.
            review:
              field.value === null || field.value === undefined || !hasOrigin
                ? true
                : field.review === true,
          },
        ];
      }),
    );

    const confidence = typeof body.confidence === 'number' ? body.confidence : 0;

    this.logger.log('Intenção traduzida', {
      command,
      camposEmRevisao: Object.values(fields).filter((field) => field.review).length,
    });

    return {
      command,
      confidence: Math.min(Math.max(confidence, 0), 1),
      fields,
      unresolved: Array.isArray(body.unresolved)
        ? body.unresolved.filter((item): item is string => typeof item === 'string').slice(0, 10)
        : [],
    };
  }

  /**
   * O prompt. Lista apenas os comandos DISPONÍVEIS para a conta — não o catálogo inteiro.
   *
   * Não é otimização: oferecer ao modelo um comando de módulo desligado é convidá-lo a propor o que o
   * §3 proíbe propor. O filtro na entrada é mais confiável do que descartar na saída, e as duas coisas
   * são feitas.
   */
  private buildPrompt(request: IntentParseRequest): string {
    const catalogue = request.availableCommands
      .map((name) => `- ${name}: ${INTENT_COMMANDS[name].label}`)
      .join('\n');

    return [
      'Você traduz a frase de um operador de ERP em UM comando estruturado. Você NÃO executa nada,',
      'NÃO decide permissão, NÃO calcula valor e NÃO inventa dado.',
      '',
      'Comandos disponíveis:',
      catalogue,
      '',
      'Responda SOMENTE com JSON neste formato:',
      '{"command":"<nome ou null>","confidence":<0..1>,',
      ' "fields":{"<campo>":{"value":<valor ou null>,"origin":"ditado|consulta|padrao|null",',
      ' "review":<true|false>}},"unresolved":["<pergunta em português>"],"guess":"<null ou resumo>"}',
      '',
      'Regras obrigatórias:',
      '1. Campo que a frase NÃO disse vem com value null, origin null e review true.',
      '   NUNCA suponha um valor. Não dizer é diferente de dizer que não.',
      '2. Se a frase não corresponder a nenhum comando da lista, devolva command null e',
      '   preencha guess com o que a pessoa parecia querer.',
      '3. origin "ditado" só para valor que está literalmente na frase.',
      '4. unresolved em português, como pergunta curta ao operador.',
      '',
      'Frase do operador:',
      request.text,
    ].join('\n');
  }

  private baseUrl(): string | undefined {
    return this.config.get<string>('GEMINI_API_URL')?.replace(/\/+$/, '') || undefined;
  }

  private apiKey(): string | undefined {
    return this.config.get<string>('GEMINI_API_KEY') || undefined;
  }

  private model(): string | undefined {
    return this.config.get<string>('GEMINI_MODEL') || undefined;
  }
}
