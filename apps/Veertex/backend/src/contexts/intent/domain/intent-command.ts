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
 * resposta é parte do produto, não falha** — é o estado mais frequente nesta fase de nove comandos.
 * Modelá-la como resultado legítimo, e não como erro, é o que impede a tela de pedir desculpas por
 * funcionar como projetado.
 */
export interface IntentNotSupported {
  command: null;
  /** O que o usuário parecia querer, para a tela poder sugerir a rota certa. */
  guess: string | null;
  screenHint: string | null;
}

export type IntentResult = IntentPlan | IntentNotSupported;

export function isSupported(result: IntentResult): result is IntentPlan {
  return result.command !== null;
}
