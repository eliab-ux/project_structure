/**
 * The catalogue of permissions that EXIST. Fixed in code, never in the database.
 *
 * The same reasoning as `field_config` (01_Veertex_Core §3.6): the account configures what it
 * *grants*, never what *exists*. A permission is only real if some guard checks it, and a guard is
 * code — so a database row inventing `contacts.super_edit` would grant nothing and mislead whoever
 * ticked it. Validating a role against this list at write time is what keeps the two in step.
 *
 * Naming: `<area>.<action>` with optional sub-scoping (`contacts.credit_limit.edit`). Read,
 * create/update and delete are separate on purpose — 01 §3.3 asks for that separation explicitly,
 * because "can see the customer" and "can delete the customer" are not the same job.
 *
 * ⚠️ F1 covers CORE only. Each later module adds its own block here, and the default roles below
 * gain the permissions of the module when that module lands — a Representante has almost nothing
 * to do until ROT exists, and inventing permissions now would be a silent default (§9.2).
 */
export const PERMISSIONS = {
  account: {
    read: 'account.read',
    update: 'account.update',
  },
  companies: {
    read: 'companies.read',
    create: 'companies.create',
    update: 'companies.update',
    delete: 'companies.delete',
  },
  users: {
    read: 'users.read',
    create: 'users.create',
    update: 'users.update',
    disable: 'users.disable',
  },
  // Sem `delete`: nenhuma rota apaga contato nesta fatia, e o cabeçalho deste arquivo é explícito —
  // "a permission is only real if some guard checks it". Declarar `contacts.delete` daria a quem
  // monta um papel a impressão de estar concedendo (ou negando) algo que não existe. A desativação
  // é feita por `contacts.update`, que é o que a rota de fato exige.
  contacts: {
    read: 'contacts.read',
    create: 'contacts.create',
    update: 'contacts.update',
    // Carteirização (§2.3 do 02): quem TEM esta permissão vê todos os contatos da conta; quem NÃO
    // a tem fica restrito à própria carteira QUANDO a preferência `contact_carteirizacao` está
    // ligada. Chave plana, valor pontilhado (o catálogo é de um nível; `grants()` resolve wildcard).
    // O escopo é resolvido POR REQUEST (nunca no token) — ver ADR-0007.
    readAll: 'contacts.read.all',
  },
  // Sem `delete`, mesma razão de contatos: nenhuma rota apaga produto nesta fatia. Produto
  // referenciado por venda ou por nota não pode desaparecer — desativar é o que o negócio quer, e é
  // `products.update`.
  products: {
    read: 'products.read',
    create: 'products.create',
    update: 'products.update',
  },
  roles: {
    read: 'roles.read',
    create: 'roles.create',
    update: 'roles.update',
    delete: 'roles.delete',
  },
  // Personalizar Campos (§3.6). `read` para a tela ler a configuração efetiva; `update` para gravá-la.
  // Sem `delete`: remover uma sobreposição é gravar o conjunto sem ela (o `SetFieldConfig` substitui).
  fields: {
    read: 'fields.read',
    update: 'fields.update',
  },
  // Vendas (VND, §02). Separações do §3.5 e §3.8:
  //  - `discount.grant` é sub-permissão à parte: "a Ana pode vender mas não pode dar desconto";
  //  - `cancel` é separado de `update` porque cancelar não é editar — é uma transição de situação
  //    com efeito (e, depois da NF-e, vira operação fiscal). Sem `delete`: pedido não se apaga.
  orders: {
    read: 'orders.read',
    create: 'orders.create',
    update: 'orders.update',
    cancel: 'orders.cancel',
    // Chave plana, valor pontilhado: o catálogo é de um nível só (ALL_PERMISSIONS faz flatMap de
    // valores string). A sub-permissão granular vive no VALOR ('orders.discount.grant'), que o
    // `grants()` resolve por wildcard segmento a segmento.
    discountGrant: 'orders.discount.grant',
    // Liberar venda a cliente com título vencido além do limite da conta (06 §2.5) — exceção
    // granular; o bloqueio é o default. Mesmo desenho do desconto: decide o TOKEN, nunca o corpo.
    overdueOverride: 'orders.overdue.override',
  },
  // Estoque (EST, §03). `read` para ver saldo/custo/movimentos; `move` para registrar movimento.
  // Sem `delete`: movimento é append-only — estorno é movimento novo, nunca exclusão.
  stock: {
    read: 'stock.read',
    move: 'stock.move',
  },
  // Configuração comercial (VND — §4.2 e §3.2 do 02A). Área PRÓPRIA, separada de `orders.*` por
  // decisão do Eliab: operar pedido ≠ configurar comércio. Cobre as condições de pagamento nomeadas
  // e as tabelas de preço (price_lists). Granularidade estilo Bling: `read` para consultar, `manage`
  // para criar/editar/desativar. A CHAVE da área é `sales` (o primeiro segmento da permissão) — é o
  // que o agrupamento da tela usa (`permission.startsWith(area + '.')`); os valores carregam o
  // sub-escopo `sales.settings.*`, que o `grants()` resolve por wildcard segmento a segmento.
  sales: {
    settingsRead: 'sales.settings.read',
    settingsManage: 'sales.settings.manage',
  },
  // Financeiro (FIN, §05). `read` para ver contas/categorias/títulos/cards; `settings` para o cadastro
  // de contas financeiras e a árvore de categorias; `receivable`/`payable` para lançar títulos;
  // `settle` para dar baixa (separada de lançar: quem registra o título nem sempre é quem baixa).
  // Chaves planas, valores pontilhados; a área é `finance` (primeiro segmento) p/ o agrupamento casar.
  finance: {
    read: 'finance.read',
    settings: 'finance.settings',
    receivable: 'finance.receivable.manage',
    payable: 'finance.payable.manage',
    settle: 'finance.settle',
  },
  // Rota / Consignação (ROT, §04). `read` para ver rotas/viagens/carteiras; `settings` para o
  // cadastro de rotas e a Regra Comercial do representante; `trip` para operar a viagem (abrir carga,
  // conferir/efetivar acerto e fechamento na retaguarda). O app do representante (campo) é fatia
  // futura com autorização própria. Área `rot` (primeiro segmento).
  rot: {
    read: 'rot.read',
    settings: 'rot.settings',
    trip: 'rot.trip.manage',
  },
  cob: {
    read: 'cob.read',
    manage: 'cob.manage',
  },
} as const;

/** Grants everything, present and future. Only the Admin role should hold it. */
export const WILDCARD = '*';

/** Flat list of every valid permission string — the whitelist a role is validated against. */
export const ALL_PERMISSIONS: string[] = Object.values(PERMISSIONS).flatMap((area) =>
  Object.values(area),
);

/** The areas that exist, for the UI to render the permission tree by group. */
export const PERMISSION_AREAS = Object.keys(PERMISSIONS);

/**
 * Whether a set of granted permissions satisfies a required one.
 *
 * Accepts three shapes of grant: the exact permission, an area wildcard (`companies.*`) and the
 * global wildcard (`*`). Prefix wildcards are resolved segment by segment so that
 * `contacts.credit_limit.*` grants `contacts.credit_limit.edit` but NOT `contacts.delete` — a
 * naive `startsWith` would have granted both, which is how a wildcard quietly becomes an escalation.
 *
 * Pure function, no framework: used by the domain (PermissionSet) and by the HTTP guard alike.
 */
export function grants(granted: readonly string[], required: string): boolean {
  if (granted.includes(WILDCARD) || granted.includes(required)) {
    return true;
  }

  const segments = required.split('.');
  // `a.b.c` → check `a.*`, then `a.b.*`. The full `a.b.c.*` is meaningless and not generated.
  for (let i = 1; i < segments.length; i += 1) {
    if (granted.includes(`${segments.slice(0, i).join('.')}.${WILDCARD}`)) {
      return true;
    }
  }
  return false;
}

/** True when the string is a permission this build knows about, or a well-formed wildcard. */
export function isKnownPermission(permission: string): boolean {
  if (permission === WILDCARD) {
    return true;
  }
  if (permission.endsWith(`.${WILDCARD}`)) {
    const prefix = permission.slice(0, -2);
    return ALL_PERMISSIONS.some((known) => known === prefix || known.startsWith(`${prefix}.`));
  }
  return ALL_PERMISSIONS.includes(permission);
}
