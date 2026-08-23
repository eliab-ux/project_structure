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

/**
 * O TIPO de um campo do comando — o que o painel edita e o `FieldReader` do approve lê.
 * `list` = array de strings · `flag` = booleano · `address` = objeto de endereço (não editável
 * no painel; vem por imagem/consulta ou pela tela própria).
 */
export type IntentFieldKind = 'text' | 'list' | 'number' | 'flag' | 'address';

export interface IntentFieldSpec {
  name: string;
  kind: IntentFieldKind;
  required: boolean;
  /** Dica curta em português — vai no prompt do tradutor e serve de documentação. */
  hint: string;
}

/**
 * A ESPECIFICAÇÃO DE CAMPOS de cada comando — a mesma lista que o dispatch do `ApproveIntent` lê.
 *
 * Nasceu da varredura de 23/08/2026 (defeito real: o approve do `CreateRole` exigia `code`, que o
 * tradutor nunca produzia — o prompt do Gemini listava só nome+label dos comandos, e o modelo
 * INVENTAVA os nomes de campo por convenção). Três consequências desta tabela:
 *
 *  1. o prompt do tradutor enumera os campos EXATOS (nome, tipo, obrigatório) — fim do palpite;
 *  2. o teste de contrato (`intent-catalog-contract.spec.ts`) aprova cada comando com exatamente
 *     estes campos e falha se o dispatch pedir algo fora da tabela — o descompasso morre no CI,
 *     não na frente do operador;
 *  3. o painel pode um dia derivar labels/editor por tipo daqui, sem segunda fonte.
 *
 * ⚠️ Mudou o dispatch? Muda AQUI no mesmo commit — o teste de contrato é quem cobra.
 */
export const INTENT_COMMAND_FIELDS: Record<IntentCommandName, IntentFieldSpec[]> = {
  CreateCompany: [
    { name: 'legalName', kind: 'text', required: true, hint: 'razão social' },
    { name: 'document', kind: 'text', required: true, hint: 'CNPJ, só dígitos' },
    { name: 'taxRegime', kind: 'text', required: true, hint: 'SIMPLES | NORMAL | MEI' },
    { name: 'address', kind: 'address', required: true, hint: 'endereço completo' },
    { name: 'stateRegistrationExempt', kind: 'flag', required: true, hint: 'IE isenta?' },
    { name: 'tradeName', kind: 'text', required: false, hint: 'nome fantasia' },
    { name: 'stateRegistration', kind: 'text', required: false, hint: 'inscrição estadual' },
    { name: 'municipalRegistration', kind: 'text', required: false, hint: 'inscrição municipal' },
    { name: 'suframa', kind: 'text', required: false, hint: 'SUFRAMA' },
    { name: 'cnae', kind: 'text', required: false, hint: 'CNAE principal' },
    { name: 'contactEmail', kind: 'text', required: false, hint: 'e-mail de contato' },
    { name: 'billingEmail', kind: 'text', required: false, hint: 'e-mail de cobrança' },
    { name: 'phone', kind: 'text', required: false, hint: 'telefone' },
  ],
  UpdateCompany: [
    { name: 'companyId', kind: 'text', required: true, hint: 'id da empresa' },
    { name: 'legalName', kind: 'text', required: false, hint: 'razão social' },
    { name: 'tradeName', kind: 'text', required: false, hint: 'nome fantasia' },
    { name: 'taxRegime', kind: 'text', required: false, hint: 'SIMPLES | NORMAL | MEI' },
    { name: 'stateRegistration', kind: 'text', required: false, hint: 'inscrição estadual' },
    { name: 'municipalRegistration', kind: 'text', required: false, hint: 'inscrição municipal' },
    { name: 'suframa', kind: 'text', required: false, hint: 'SUFRAMA' },
    { name: 'cnae', kind: 'text', required: false, hint: 'CNAE' },
    { name: 'contactEmail', kind: 'text', required: false, hint: 'e-mail de contato' },
    { name: 'billingEmail', kind: 'text', required: false, hint: 'e-mail de cobrança' },
    { name: 'phone', kind: 'text', required: false, hint: 'telefone' },
  ],
  InviteUser: [
    { name: 'name', kind: 'text', required: true, hint: 'nome da pessoa' },
    { name: 'email', kind: 'text', required: true, hint: 'e-mail (será o login)' },
    { name: 'phone', kind: 'text', required: true, hint: 'WhatsApp com DDD (obrigatório)' },
    { name: 'password', kind: 'text', required: true, hint: 'senha provisória' },
    { name: 'roleId', kind: 'text', required: true, hint: 'id do papel' },
  ],
  UpdateUser: [
    { name: 'userId', kind: 'text', required: true, hint: 'id do usuário' },
    { name: 'name', kind: 'text', required: false, hint: 'novo nome' },
    { name: 'email', kind: 'text', required: false, hint: 'novo e-mail' },
    { name: 'phone', kind: 'text', required: false, hint: 'novo WhatsApp' },
    { name: 'roleId', kind: 'text', required: false, hint: 'novo papel (id)' },
  ],
  AssignRole: [
    { name: 'userId', kind: 'text', required: true, hint: 'id do usuário' },
    { name: 'roleId', kind: 'text', required: true, hint: 'id do papel de destino' },
  ],
  CreateRole: [
    { name: 'name', kind: 'text', required: true, hint: 'nome do papel' },
    // `code` NÃO é ditado: o rascunho o DERIVA do nome (BuildIntentDraft) e o exibe. Continua na
    // spec porque o dispatch o lê — o teste de contrato preenche e confere.
    { name: 'code', kind: 'text', required: true, hint: 'código interno — derivado do nome' },
    { name: 'permissions', kind: 'list', required: true, hint: 'códigos de permissão' },
    { name: 'description', kind: 'text', required: false, hint: 'descrição' },
  ],
  SetRolePermissions: [
    { name: 'roleId', kind: 'text', required: true, hint: 'id do papel' },
    { name: 'permissions', kind: 'list', required: true, hint: 'códigos de permissão (substitui)' },
  ],
  CreateContact: [
    { name: 'types', kind: 'list', required: true, hint: 'customer | supplier | carrier | reseller' },
    { name: 'personKind', kind: 'text', required: true, hint: 'individual | company' },
    { name: 'legalName', kind: 'text', required: true, hint: 'nome ou razão social' },
    { name: 'tradeName', kind: 'text', required: false, hint: 'nome fantasia' },
    { name: 'document', kind: 'text', required: false, hint: 'CPF/CNPJ, só dígitos' },
    { name: 'notes', kind: 'text', required: false, hint: 'observações' },
    { name: 'email', kind: 'text', required: false, hint: 'e-mail' },
    { name: 'phone', kind: 'text', required: false, hint: 'telefone/WhatsApp' },
  ],
  UpdateContact: [
    { name: 'contactId', kind: 'text', required: true, hint: 'id do contato' },
    { name: 'legalName', kind: 'text', required: false, hint: 'novo nome' },
    { name: 'tradeName', kind: 'text', required: false, hint: 'nome fantasia' },
    { name: 'notes', kind: 'text', required: false, hint: 'observações' },
  ],
  CreateProduct: [
    { name: 'name', kind: 'text', required: true, hint: 'nome do produto' },
    { name: 'unit', kind: 'text', required: true, hint: 'unidade comercial (UN, KG, CX...)' },
    { name: 'sku', kind: 'text', required: false, hint: 'SKU' },
    { name: 'kind', kind: 'text', required: false, hint: 'tipo do produto' },
    { name: 'brand', kind: 'text', required: false, hint: 'marca' },
    { name: 'categoryPath', kind: 'text', required: false, hint: 'categoria (caminho)' },
    { name: 'basePrice', kind: 'number', required: false, hint: 'preço base' },
    { name: 'barcode', kind: 'text', required: false, hint: 'código de barras' },
    { name: 'shortDescription', kind: 'text', required: false, hint: 'descrição curta' },
    { name: 'ncm', kind: 'text', required: false, hint: 'NCM' },
    { name: 'grossWeightKg', kind: 'number', required: false, hint: 'peso bruto (kg)' },
  ],
  UpdateProduct: [
    { name: 'productId', kind: 'text', required: true, hint: 'id do produto' },
    { name: 'name', kind: 'text', required: false, hint: 'novo nome' },
    { name: 'unit', kind: 'text', required: false, hint: 'unidade' },
    { name: 'sku', kind: 'text', required: false, hint: 'SKU' },
    { name: 'brand', kind: 'text', required: false, hint: 'marca' },
    { name: 'categoryPath', kind: 'text', required: false, hint: 'categoria' },
    { name: 'basePrice', kind: 'number', required: false, hint: 'preço base' },
    { name: 'shortDescription', kind: 'text', required: false, hint: 'descrição curta' },
  ],
  ToggleModule: [
    { name: 'moduleCode', kind: 'text', required: true, hint: 'VND | EST | FIN | ROT | ...' },
    { name: 'active', kind: 'flag', required: true, hint: 'true = ativar, false = desativar' },
  ],
};


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
