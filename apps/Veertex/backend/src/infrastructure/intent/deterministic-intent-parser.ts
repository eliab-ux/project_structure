import { Injectable, Logger } from '@nestjs/common';
import {
  IntentParseRequest,
  IntentParserPort,
} from '../../contexts/intent/application/ports/output/intent-parser.port';
import {
  INTENT_COMMANDS,
  IntentCommandName,
  IntentResult,
} from '../../contexts/intent/domain/intent-command';
import { looksLikeQuestion, QUESTION_GUESS } from '../../contexts/intent/domain/question-detection';

/**
 * Tradutor DETERMINÍSTICO, por palavra-chave. É o adapter dos testes e do desenvolvimento sem chave.
 *
 * **Por que ele existe** (decidido por Eliab, 12/08/2026): sem ele, todo teste da Mesa dependeria de
 * chamada externa paga e não determinística — e teste que não se pode rodar é teste que se aprende a
 * ignorar. Com ele, o fluxo inteiro (traduzir → validar → aprovar → executar) é exercitável de ponta
 * a ponta, incluindo o que mais importa: que um comando emitido pela tradução passe pelos mesmos
 * guards que um clique.
 *
 * **O que ele NÃO é.** Não é um fallback de produção. Se a chave do Gemini faltar, o adapter real
 * recusa — não cai para cá. Cair para cá em produção significaria devolver comando enlatado a partir
 * de palavra-chave e chamá-lo de tradução: o usuário aprovaria uma ação que o texto dele não pedia, e
 * a procedência mentiria dizendo "ditado". A escolha entre os dois é feita no módulo, por
 * configuração explícita, e o adapter real nunca delega para este.
 *
 * A tradução por palavra-chave é grosseira de propósito. Ela não tenta parecer inteligente: reconhece
 * um verbo e um objeto, devolve o comando com os campos em `null` e `review: true`, e deixa
 * `unresolved` dizendo o que falta. É exatamente o comportamento que a especificação exige do caminho
 * real quando o texto não resolve um campo — o que faz deste adapter um teste honesto do caso comum,
 * e não só do caso feliz.
 */
@Injectable()
export class DeterministicIntentParser implements IntentParserPort {
  private readonly logger = new Logger(DeterministicIntentParser.name);

  /**
   * Palavras que sugerem cada comando. Ordem importa: a primeira regra cujo gatilho aparecer no texto
   * ganha, então o mais específico vem antes.
   *
   * `SetRolePermissions` precede `CreateRole` porque "pode vender mas não pode dar desconto" fala de
   * permissão sem dizer "criar papel" — e é a frase do §5.1, o caso que a tela de Papéis existe para
   * atender.
   */
  // Não há regra para `UploadCompanyCertificate`: ele saiu do catálogo por não ter use case (ver o
  // comentário no fim de `intent-command.ts`). Um gatilho aqui reconheceria a palavra "certificado" e
  // proporia uma ação que a aprovação não conseguiria executar.
  private static readonly RULES: {
    command: IntentCommandName;
    triggers: string[];
    fields: string[];
    unresolved: string[];
  }[] = [
    {
      command: 'SetRolePermissions',
      triggers: ['pode ', 'não pode', 'permiss', 'acesso a'],
      fields: ['roleId', 'permissions'],
      unresolved: ['qual papel exatamente', 'quais permissões exatamente'],
    },
    {
      command: 'ToggleModule',
      triggers: ['ativar módulo', 'desativar módulo', 'ligar o módulo', 'desligar o módulo'],
      fields: ['moduleCode', 'active'],
      unresolved: ['qual módulo'],
    },
    {
      command: 'AssignRole',
      triggers: ['virar ', 'passar a ser', 'trocar o papel', 'mudar o papel'],
      fields: ['userId', 'roleId'],
      unresolved: ['qual usuário', 'para qual papel'],
    },
    {
      command: 'CreateRole',
      triggers: ['criar papel', 'novo papel'],
      fields: ['code', 'name', 'permissions'],
      unresolved: ['o código e o nome do papel', 'quais permissões'],
    },
    {
      command: 'InviteUser',
      triggers: ['criar usuário', 'novo usuário', 'cadastrar usuário', 'convidar'],
      fields: ['name', 'email', 'phone', 'roleId'],
      // O WhatsApp aparece na lista porque é obrigatório (regra 9 do CLAUDE.md) e porque um texto
      // ditado quase nunca o traz — pedir é o comportamento certo, supor não é.
      unresolved: ['o nome', 'o e-mail', 'o WhatsApp', 'qual papel'],
    },
    {
      command: 'UpdateUser',
      triggers: ['alterar usuário', 'editar usuário', 'atualizar usuário'],
      fields: ['userId'],
      unresolved: ['qual usuário', 'o que muda'],
    },
    {
      // Antes de CreateCompany: "cadastrar cliente" e "cadastrar empresa" competem pela palavra
      // "cadastrar", e a mais específica tem de ganhar. A ordem das regras é a desempate.
      command: 'CreateContact',
      triggers: [
        'cadastrar cliente',
        'novo cliente',
        'cadastrar contato',
        'novo contato',
        'cadastrar fornecedor',
        'novo fornecedor',
      ],
      fields: ['types', 'personKind', 'legalName'],
      unresolved: ['o nome ou razão social', 'se é pessoa física ou jurídica', 'quais tipos'],
    },
    {
      command: 'UpdateContact',
      triggers: ['alterar cliente', 'editar cliente', 'alterar contato', 'editar contato'],
      fields: ['contactId'],
      unresolved: ['qual contato', 'o que muda'],
    },
    {
      command: 'CreateCompany',
      triggers: ['criar empresa', 'nova empresa', 'cadastrar empresa', 'abrir empresa'],
      fields: ['legalName', 'document', 'taxRegime', 'address'],
      unresolved: ['a razão social', 'o CNPJ', 'o regime tributário', 'o endereço'],
    },
    {
      command: 'UpdateCompany',
      triggers: ['alterar empresa', 'editar empresa', 'atualizar empresa'],
      fields: ['companyId'],
      unresolved: ['qual empresa', 'o que muda'],
    },
  ];

  ensureAvailable(): void {
    // Sempre disponível: não depende de rede nem de credencial. É metade do valor dele.
  }

  async parse(request: IntentParseRequest): Promise<IntentResult> {
    const text = (request.text ?? '').toLowerCase();

    /*
     * PERGUNTA NUNCA VIRA ESCRITA — antes de qualquer regra.
     *
     * Este parser errava as quatro interrogativas que o de produção acertava (medido em 13/08/2026):
     * `'pode '` casava com "quem pode dar desconto" e devolvia `SetRolePermissions`. A guarda vem
     * primeiro porque a decisão é sobre a FORMA da frase, e nenhuma regra de palavra-chave deve ter a
     * chance de opinar sobre uma pergunta. Ver `looksLikeQuestion()`.
     */
    if (looksLikeQuestion(text)) {
      this.logger.debug('Frase interrogativa — nenhum comando de escrita é proposto');
      return { command: null, guess: QUESTION_GUESS, screenHint: null };
    }

    const rule = DeterministicIntentParser.RULES.find(
      (candidate) =>
        // Só considera comando que a conta pode receber — `plano ∩ conta` já resolvido pelo chamador.
        // Sem este filtro, o parser proporia ação de módulo desligado, e o §3 diz que módulo inativo
        // NUNCA é proposto.
        request.availableCommands.includes(candidate.command) &&
        candidate.triggers.some((trigger) => text.includes(trigger)),
    );

    if (!rule) {
      this.logger.debug('Intenção fora do catálogo determinístico');
      return {
        command: null,
        guess: null,
        screenHint: null,
      };
    }

    return {
      command: rule.command,
      // Fixa e MODESTA de propósito: 0.5 obriga a tela a exibir o atrito calibrado do §6.4 em vez de
      // oferecer o `⏎` fácil. Um adapter de teste que devolvesse 0.99 faria os testes exercitarem só
      // o caminho de alta confiança — que é o menos comum de todos.
      confidence: 0.5,
      fields: Object.fromEntries(
        rule.fields.map((field) => [field, { value: null, origin: null, review: true }]),
      ),
      unresolved: [...rule.unresolved],
    };
  }

  /** Só para o teste conferir que o catálogo do parser e o do domínio não divergiram. */
  static coveredCommands(): IntentCommandName[] {
    return DeterministicIntentParser.RULES.map((rule) => rule.command);
  }

  static catalogueSize(): number {
    return Object.keys(INTENT_COMMANDS).length;
  }
}
