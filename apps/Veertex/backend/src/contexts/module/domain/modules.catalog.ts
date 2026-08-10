/**
 * O catálogo de módulos que EXISTEM. Fixo em código, nunca no banco.
 *
 * Mesma razão do `permissions.catalog.ts`: um módulo só é real se houver código implementando-o.
 * Uma linha inventada na tabela `modules` ativaria um módulo que não faz nada — e a conta veria um
 * item de menu que leva a lugar nenhum. O seed do boot reconcilia esta lista para a tabela; a
 * tabela existe para integridade referencial e para a tela administrativa, não como autoridade.
 *
 * `dependsOn` só contém dependências que a documentação de requisitos DECLARA
 * (01_Veertex_Core §3.7): COB→FIN, ROT→EST, CAN→VND+EST. Deliberadamente NÃO inferi outras que
 * pareceriam óbvias — EXP→EST é a candidata mais tentadora, e continua fora justamente por isso:
 * seria um silent default (Visão Geral §9.2) numa regra que bloqueia ativação de módulo pago.
 * Quando o MD do módulo EXP definir, entra aqui.
 *
 * ── Arestas do §3.7 ainda NÃO semeadas (decisão do Eliab, 10/08/2026) ─────────────────────────
 * O 01_Veertex_Core §3.7 declara, além das três acima, mais duas:
 *
 *     PDV → EST          (o PDV exige estoque)
 *     FUNIL → CRM        (o funil exige CRM)
 *
 * Ficam fora porque PDV, FUNIL e CRM não estão no catálogo da V1. A FK é
 * `account_modules.module_code → modules.code`, então a aresta exigiria o módulo alvo na tabela —
 * e um módulo no catálogo é um módulo que a conta CONSEGUE ATIVAR. Adicioná-los agora criaria um
 * toggle que liga algo sem código atrás, o que é pior do que a aresta ausente: o cliente pagaria
 * por um módulo vazio.
 *
 * Cada uma entra junto com o módulo dela. Este comentário existe para que a aresta não seja
 * redescoberta a partir do zero quando o PDV chegar.
 */
export interface ModuleDefinition {
  code: string;
  name: string;
  description: string;
  /** Códigos que precisam estar ativos para este poder ser ativado. */
  dependsOn: readonly string[];
  /** `true` = sempre ativo, não desativável. Hoje só o CORE. */
  core: boolean;
}

export const MODULES = {
  CORE: 'CORE',
  VND: 'VND',
  EST: 'EST',
  ROT: 'ROT',
  FIN: 'FIN',
  COB: 'COB',
  FIS: 'FIS',
  CAN: 'CAN',
  EXP: 'EXP',
} as const;

export type ModuleCode = (typeof MODULES)[keyof typeof MODULES];

/**
 * Os nove módulos da V1 (Visão Geral §4). Os das ondas seguintes — PDV, PRD, ENT, CRM, CMP, OS,
 * CTB, COM, Vitrine — entram quando o código deles entrar, e não antes: um módulo listado aqui é
 * um módulo que a conta consegue ativar.
 */
export const MODULE_CATALOG: readonly ModuleDefinition[] = [
  {
    code: MODULES.CORE,
    name: 'Fundação',
    description: 'Conta, empresas, usuários, papéis, contatos e produtos. Sempre ativo.',
    dependsOn: [],
    core: true,
  },
  {
    code: MODULES.VND,
    name: 'Vendas',
    description: 'Orçamentos, pedidos, tabelas de preço e comissões.',
    dependsOn: [],
    core: false,
  },
  {
    code: MODULES.EST,
    name: 'Estoque',
    description: 'Estoque multi-local por CNPJ, movimentos, inventário e transferências.',
    dependsOn: [],
    core: false,
  },
  {
    code: MODULES.FIN,
    name: 'Financeiro',
    description: 'Contas a pagar e a receber, categorias para DRE e fluxo de caixa.',
    dependsOn: [],
    core: false,
  },
  {
    code: MODULES.ROT,
    name: 'Rota / Consignação',
    description: 'Viagens, consignação, acerto e app do representante.',
    dependsOn: [MODULES.EST],
    core: false,
  },
  {
    code: MODULES.COB,
    name: 'Cobrança',
    description: 'Crediário, promissórias e boletos.',
    dependsOn: [MODULES.FIN],
    core: false,
  },
  {
    code: MODULES.FIS,
    name: 'Fiscal',
    description: 'NF-e e NFC-e com contingência.',
    dependsOn: [],
    core: false,
  },
  {
    code: MODULES.CAN,
    name: 'Canais / Marketplace',
    description: 'Integração com marketplaces.',
    dependsOn: [MODULES.VND, MODULES.EST],
    core: false,
  },
  {
    code: MODULES.EXP,
    name: 'Expedição',
    description: 'Fila por origem, separação, conferência, etiqueta e despacho.',
    dependsOn: [],
    core: false,
  },
];

const BY_CODE = new Map(MODULE_CATALOG.map((module) => [module.code, module]));

export function findModule(code: string): ModuleDefinition | undefined {
  return BY_CODE.get(code);
}

export function isKnownModule(code: string): boolean {
  return BY_CODE.has(code);
}

/** Códigos sempre ativos, independentemente de plano ou de ativação — hoje, só o CORE. */
export const CORE_MODULE_CODES: readonly string[] = MODULE_CATALOG.filter(
  (module) => module.core,
).map((module) => module.code);

/**
 * Módulos que dependem de `code` — quem quebraria se ele fosse desativado.
 *
 * Calculado a partir do próprio catálogo em vez de mantido numa segunda lista: duas listas para a
 * mesma relação divergiriam, e a divergência apareceria como um módulo desativável que, desativado,
 * deixa outro pendurado numa dependência que não existe mais.
 */
export function dependentsOf(code: string): string[] {
  return MODULE_CATALOG.filter((module) => module.dependsOn.includes(code)).map(
    (module) => module.code,
  );
}

/**
 * O conjunto EFETIVO de módulos: `plano ∩ conta`, mais os core.
 *
 * É o que viaja no token e o que o `ModuleGuard` consulta. A terceira interseção da regra
 * `plano ∩ conta ∩ papel` (Visão Geral §2.1) é a permissão, checada separadamente — os dois eixos
 * evoluem por motivos diferentes e por isso não se misturam num cálculo só.
 *
 * Os core entram sempre, inclusive quando o plano não os lista: o CORE não é desativável, e um
 * plano mal cadastrado que o omitisse produziria uma conta que não consegue nem abrir a tela de
 * configurações para corrigir o plano.
 */
export function resolveEffectiveModules(params: {
  planModules: readonly string[];
  activeAccountModules: readonly string[];
}): string[] {
  const plan = new Set(params.planModules);
  const active = new Set(params.activeAccountModules);

  const effective = MODULE_CATALOG.filter(
    (module) => module.core || (plan.has(module.code) && active.has(module.code)),
  ).map((module) => module.code);

  return effective.sort();
}
