/**
 * O catálogo de comandos que a tradução de intenção sabe produzir, e o que cada um exige.
 *
 * **Fixo em código, nunca no banco** — mesmo raciocínio do `permissions.catalog.ts`: um comando só é
 * real se existe um Use Case que o executa e um guard que o autoriza, e as duas coisas são código.
 * Uma linha de banco inventando `DeleteAllCompanies` não executaria nada e enganaria quem a lesse.
 *
 * **`requiredPermission` é o coração da segurança desta fatia.** A especificação §8 diz: *"A IA não é
 * caminho paralelo de autorização. Comando emitido pelo modelo passa pelos mesmos guards que um
 * clique."* Aqui isso deixa de ser intenção e passa a ser dado: cada comando declara a MESMA
 * permissão que o endpoint equivalente exige, e a aprovação verifica com a MESMA função `grants()`.
 *
 * Sem esta tabela, a rota de intenção seria uma segunda porta de autorização — e uma segunda porta é
 * onde a permissão divergente mora.
 */
import { PERMISSIONS } from '../../role/domain/permissions.catalog';

export const INTENT_COMMANDS = {
  CreateCompany: {
    label: 'Cadastrar empresa',
    requiredPermission: PERMISSIONS.companies.create,
    /** O módulo que precisa estar ativo. `null` = é CORE, sempre disponível. */
    requiredModule: null,
  },
  UpdateCompany: {
    label: 'Alterar empresa',
    requiredPermission: PERMISSIONS.companies.update,
    requiredModule: null,
  },
  InviteUser: {
    label: 'Criar usuário',
    requiredPermission: PERMISSIONS.users.create,
    requiredModule: null,
  },
  UpdateUser: {
    label: 'Alterar usuário',
    requiredPermission: PERMISSIONS.users.update,
    requiredModule: null,
  },
  AssignRole: {
    // Trocar o papel de alguém é alterar usuário, não alterar papel — e a permissão segue o objeto
    // alterado. Confundir os dois daria a quem só administra papéis o poder de promover usuários.
    label: 'Trocar o papel de um usuário',
    requiredPermission: PERMISSIONS.users.update,
    requiredModule: null,
  },
  CreateRole: {
    label: 'Criar papel',
    requiredPermission: PERMISSIONS.roles.create,
    requiredModule: null,
  },
  SetRolePermissions: {
    label: 'Definir as permissões de um papel',
    requiredPermission: PERMISSIONS.roles.update,
    requiredModule: null,
  },
  /*
   * CreateContact e UpdateContact são SEPARADOS, e não um `UpsertContact` (decisão de Eliab,
   * 14/08/2026). O §4 do CORE nomeia o use case do domínio como upsert, e o domínio pode ser upsert
   * — mas a Mesa precisa dizer ao humano QUAL das duas coisas vai acontecer. "Cadastrar o cliente
   * João" resolvendo silenciosamente em atualização de um João existente é uma alteração que o
   * operador não pediu e não viu.
   */
  CreateContact: {
    label: 'Cadastrar contato',
    requiredPermission: PERMISSIONS.contacts.create,
    requiredModule: null,
  },
  UpdateContact: {
    label: 'Alterar contato',
    requiredPermission: PERMISSIONS.contacts.update,
    requiredModule: null,
  },
  /*
   * CreateProduct e UpdateProduct são SEPARADOS pela mesma razão de CreateContact/UpdateContact: a
   * Mesa precisa dizer ao humano QUAL das duas coisas vai acontecer. "Cadastrar o parafuso M8"
   * resolvendo em silêncio numa alteração de um parafuso existente é uma edição que o operador não
   * pediu — e no produto o estrago é maior, porque preço alterado por engano vai para a próxima
   * venda.
   *
   * ⚠️ Não existe comando de KIT, e a ausência acompanha a decisão do §3.5: o kit ficou fora por
   * inteiro até o EST existir. Um comando aqui faria a Mesa aceitar "montar um kit com 3 itens",
   * construir o rascunho e falhar na aprovação — ou, pior, gravar uma composição que nunca baixa
   * estoque.
   */
  CreateProduct: {
    label: 'Cadastrar produto',
    requiredPermission: PERMISSIONS.products.create,
    requiredModule: null,
  },
  UpdateProduct: {
    label: 'Alterar produto',
    requiredPermission: PERMISSIONS.products.update,
    requiredModule: null,
  },
  ToggleModule: {
    // Ativar e desativar módulo é configuração da CONTA, não de papel.
    label: 'Ativar ou desativar módulo',
    requiredPermission: PERMISSIONS.account.update,
    requiredModule: null,
  },
} as const;

/**
 * ⚠️ `UploadCompanyCertificate` está FORA do catálogo, apesar de o §2 da especificação listá-lo.
 *
 * Motivo: **não existe backend para ele.** Não há use case de upload de certificado, nem adapter de
 * storage, nem endpoint — só o campo na entidade `Company`. O §10 é explícito: *"casca que suporta
 * comando inexistente é dívida, não preparo"*. Um comando no catálogo é uma promessa de que o
 * `approve` executa; incluí-lo faria a Mesa aceitar a intenção, montar o rascunho, e falhar na
 * aprovação — depois de o operador ter digitado a senha do certificado.
 *
 * Ele volta ao catálogo junto com a fatia que implementar o upload (cifrar o pfx/p12, guardar a senha
 * cifrada, exibir validade — §3.2 do CORE), e não antes.
 */

/**
 * ⚠️ `CreateOrder`/`UpdateOrder` estão FORA do catálogo de propósito (decisão de Eliab, 22/08/2026),
 * mesmo com backend pronto (VND, §02) — e a razão é diferente da do KIT.
 *
 * Não é falta de backend: é que o pedido é o objeto mais complexo do sistema (`items[]`), e o painel
 * de rascunho da Mesa **não edita campos aninhados** por decisão registrada (§10 / `IntentDraftPanel`).
 * Um comando aqui aceitaria a intenção, montaria o rascunho e o operador não conseguiria preencher os
 * itens — casca que falha na aprovação. E ditar um pedido por frase competiria com um formulário que
 * acabou de ficar bom: a Mesa ganha onde substitui digitação repetitiva, não onde duplica uma tela
 * melhor.
 *
 * **O caso que justifica o editor de itens da Mesa, quando vier, é a ENTRADA POR IMAGEM** — fotografar
 * o pedido do cliente e ter os itens lidos (§7 do `DEPENDENCIAS_EXTERNAS.md`, ADR-0006). Aí o desenho
 * do editor nasce do caso real, não do genérico. Até lá, os comandos de pedido ficam fora e não se
 * cria casca.
 */

export type IntentCommandName = keyof typeof INTENT_COMMANDS;

export const INTENT_COMMAND_NAMES = Object.keys(INTENT_COMMANDS) as IntentCommandName[];

export function isKnownIntentCommand(name: string): name is IntentCommandName {
  return Object.prototype.hasOwnProperty.call(INTENT_COMMANDS, name);
}

/**
 * A procedência de um campo — de onde o valor veio.
 *
 * `origin` é OBRIGATÓRIO por campo (§6.1 da especificação de frontend): é o que sustenta a exibição
 * de procedência, e é o que permite ao usuário distinguir o que ele ditou do que o sistema deduziu.
 * Um rascunho que não diz de onde tirou um número é um rascunho que pede aprovação cega.
 */
export type FieldOrigin =
  | 'ditado' // ouvido/escrito na intenção do operador
  | 'consulta' // resolvido por consulta (CNPJ, IBGE) — port de provider
  | 'padrao' // padrão da conta ou da empresa ativa
  | 'ajustado' // editado pelo usuário no rascunho
  | 'externo'; // veio de fonte externa não confiável — §6.1 exige distinção visual

export interface IntentField {
  value: unknown;
  origin: FieldOrigin | null;
  /** `true` = precisa de decisão humana antes de aprovar. Campos assim sobem na tela (§6.2). */
  review: boolean;
}

/**
 * O que a tradução devolve. **Nunca prosa livre, nunca SQL, nunca cálculo, nunca autorização** — o
 * §2 da especificação é explícito, e o schema é o que torna a fronteira verificável em vez de
 * confiada.
 */
export interface IntentPlan {
  command: IntentCommandName;
  confidence: number;
  fields: Record<string, IntentField>;
  /** Perguntas em aberto, em português, para a tela mostrar. */
  unresolved: string[];
}

/**
 * Intenção que o catálogo não cobre.
 *
 * Resolve em "ainda não sei fazer isso" com o caminho de tela correspondente, e o §2 diz que **essa
 * resposta é parte do produto, não falha** — é o estado mais frequente nesta fase de oito comandos.
 * Modelá-la como resultado legítimo, e não como erro, é o que impede a tela de pedir desculpas por
 * funcionar como projetado.
 */
export interface IntentNotSupported {
  command: null;
  /** O que o usuário parecia querer, para a tela poder sugerir a rota certa. */
  guess: string | null;
  screenHint: string | null;
}

/** Um comando oferecível ao operador: o nome técnico e o rótulo que ele lê. */
export interface IntentCommandOption {
  command: IntentCommandName;
  label: string;
}

/**
 * A recusa como ela chega na tela: "não sei isso" **acompanhado do que eu sei**.
 *
 * Por que a lista viaja com a recusa, e não numa rota de catálogo: sem ela, os oito comandos só se
 * descobrem por tentativa e erro, e um campo aberto que não revela seu alcance treina o operador a
 * desistir dele. A recusa é o momento exato em que a pergunta "então o que você faz?" existe.
 *
 * A lista é `plano ∩ conta ∩ papel` — a MESMA de `availableFor()` que o tradutor recebeu. Ela nunca
 * pode ser o catálogo inteiro: oferecer comando de módulo desligado contradiz o §3 ("módulo inativo
 * nunca é proposto"), e oferecer comando que o papel não tem enumera capacidade para quem não a
 * possui e termina em 403 previsível. Papel sem nenhuma permissão de escrita recebe lista vazia.
 */
export interface IntentRejection extends IntentNotSupported {
  available: IntentCommandOption[];
}

/**
 * O que o PARSER devolve. Ele não conhece `available` — de propósito: quem pode fazer o quê é
 * decisão de autorização, e o tradutor não participa dela (§8).
 */
export type IntentResult = IntentPlan | IntentNotSupported;

/** O que a ROTA devolve. Só o use case, que autorizou, sabe montar a recusa completa. */
export type IntentApiResult = IntentPlan | IntentRejection;

export function describeCommands(names: readonly IntentCommandName[]): IntentCommandOption[] {
  return names.map((command) => ({ command, label: INTENT_COMMANDS[command].label }));
}

export function isSupported(result: IntentResult): result is IntentPlan {
  return result.command !== null;
}
