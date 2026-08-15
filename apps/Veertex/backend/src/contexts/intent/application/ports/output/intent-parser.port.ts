import { IntentCommandName, IntentResult } from '../../../domain/intent-command';

export const INTENT_PARSER = Symbol('INTENT_PARSER');

export interface IntentParseRequest {
  /**
   * O texto do operador. **Só texto nesta fatia** — voz fica para depois, por decisão de 12/08/2026:
   * a Web Speech API do Chrome envia o áudio para servidores do Google, e é o que mais pesa na
   * decisão de LGPD. O parser de texto prova a arquitetura inteira sem esse peso.
   */
  text: string;
  /** Os comandos que a conta pode receber agora — `plano ∩ conta` já resolvido pelo chamador. */
  availableCommands: IntentCommandName[];

  /**
   * UMA IMAGEM opcional — foto de documento, para o tradutor ler e preencher o rascunho.
   *
   * **Processada e descartada.** Não é gravada em disco, não vira arquivo temporário, não é
   * persistida em lugar nenhum: vive no corpo da requisição e morre com ela. O que sobra é o
   * rascunho, com procedência dizendo que veio de fonte externa.
   *
   * ⚠️ **Todo campo lido daqui nasce `origin: 'externo'` e `review: true`**, e isso é imposto pelo
   * adapter, não pedido ao modelo — ver `GeminiIntentParser.validate()`. OCR de documento erra
   * dígito de CPF, e campo desses aprovado sem leitura é cadastro errado com aparência de conferido.
   * O §6.1 exige que fonte externa seja visualmente distinguível do que o operador digitou.
   *
   * Adapter que não sabe ler imagem deve RECUSAR em voz alta, nunca ignorar o anexo: ignorar faria a
   * suíte passar enquanto produção lê a foto — a divergência que a regra 1 do `CLAUDE.md` proíbe.
   */
  attachment?: IntentAttachment;
}

export interface IntentAttachment {
  /** `image/jpeg`, `image/png` ou `image/webp` — validado no DTO, antes de chegar aqui. */
  mimeType: string;
  dataBase64: string;
}

/**
 * Traduz texto em UM comando validado por schema. **Só traduz.**
 *
 * A fronteira, que é inegociável (§2 da especificação de frontend):
 *
 *  - **entra** texto; **sai** um `IntentResult` — comando do catálogo, ou "não sei fazer isso";
 *  - campo desconhecido vem `null` com `review: true`, **nunca** um valor inventado;
 *  - nunca prosa livre, nunca SQL, nunca cálculo, nunca decisão de autorização.
 *
 * O que está fora daqui, de propósito: validar contra plano ∩ conta ∩ papel, montar o rascunho,
 * calcular número e gravar. Tudo isso é do backend, e continua sendo mesmo que o modelo "sugira" o
 * contrário — um comando emitido pelo modelo passa pelos mesmos guards que um clique.
 *
 * **O adapter nunca decide por conta própria o que fazer quando não sabe.** Devolver o comando mais
 * parecido seria pior do que devolver nada: o usuário aprovaria uma ação que não pediu, e a
 * procedência diria "ditado" para um valor que ninguém ditou.
 */
export interface IntentParserPort {
  /**
   * Este tradutor sabe ler imagem? A tela usa isto para decidir se a câmera aparece — e a resposta
   * vem de quem sabe: o adapter. O determinístico responde `false` e recusa o anexo; o Gemini
   * responde `true`.
   */
  readonly supportsAttachment: boolean;

  parse(request: IntentParseRequest): Promise<IntentResult>;

  /**
   * Se o canal de tradução está utilizável.
   *
   * Chamado ANTES de aceitar o texto, pelo mesmo motivo do canal de WhatsApp no reset de senha: uma
   * falha de configuração descoberta no meio do fluxo vira erro genérico numa tela que já pediu ao
   * usuário para escrever a intenção. Aqui não há risco de enumeração — o que se protege é o tempo
   * do operador.
   */
  ensureAvailable(): void;
}
