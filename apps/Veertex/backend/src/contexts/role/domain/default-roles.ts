import { PERMISSIONS, WILDCARD } from './permissions.catalog';

export interface DefaultRoleDefinition {
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

/** The code the onboarding and the CLI look up to assign the first user. */
export const ADMIN_ROLE_CODE = 'ADMIN';

/**
 * The seven roles every new account starts with (01_Veertex_Core §3.3).
 *
 * ⚠️ **F1 grants CORE permissions only, and that is a limitation, not a design.** A Representante
 * has essentially nothing to do until ROT exists, and a Contador nothing until FIN/CTB. Inventing
 * `orders.create` now — before any guard checks it — would be a silent default (Visão Geral §9.2)
 * and would mean the permission catalogue and the roles disagree from day one. Each module adds its
 * permissions to the catalogue AND to these defaults when it lands; accounts created before that
 * keep their adjusted roles untouched, because seeding happens once, at onboarding.
 *
 * ADMIN holds the wildcard rather than an enumeration of every permission, so it does not need
 * revisiting each time a module is added — the one role where "everything, including what does not
 * exist yet" is the intent.
 */
export const DEFAULT_ROLES: readonly DefaultRoleDefinition[] = [
  {
    code: ADMIN_ROLE_CODE,
    name: 'Administrador',
    description: 'Acesso total à conta, incluindo usuários, papéis e configurações.',
    permissions: [WILDCARD],
  },
  {
    code: 'MANAGER',
    name: 'Gestor',
    description: 'Cadastros do dia a dia e relatórios. Não administra usuários nem papéis.',
    permissions: [
      PERMISSIONS.account.read,
      PERMISSIONS.companies.read,
      // Contato é CORE, e a descrição deste papel é literalmente "cadastros do dia a dia".
      PERMISSIONS.contacts.read,
      // Vê TODOS os contatos, não só uma carteira — o Gestor administra o cadastro (carteirização
      // §2.3: quem tem `contacts.read.all` não é restrito).
      PERMISSIONS.contacts.readAll,
      PERMISSIONS.contacts.create,
      PERMISSIONS.contacts.update,
      // Produto também é CORE, e cadastrá-lo é "cadastro do dia a dia" pela mesma leitura.
      PERMISSIONS.products.read,
      PERMISSIONS.products.create,
      PERMISSIONS.products.update,
      PERMISSIONS.companies.update,
      PERMISSIONS.users.read,
      PERMISSIONS.roles.read,
    ],
  },
  {
    code: 'SUPERVISOR',
    name: 'Gerente',
    description: 'Supervisiona loja e rota. Permissões de ROT/VND chegam com esses módulos.',
    permissions: [
      PERMISSIONS.companies.read,
      PERMISSIONS.users.read,
      PERMISSIONS.contacts.read,
      // Supervisiona a operação inteira — vê todos os contatos (não é restrito à carteira).
      PERMISSIONS.contacts.readAll,
      PERMISSIONS.contacts.create,
      PERMISSIONS.contacts.update,
      PERMISSIONS.products.read,
      PERMISSIONS.products.update,
    ],
  },
  {
    code: 'CASHIER',
    name: 'Operador de Caixa',
    description: 'Opera o PDV. Permissões efetivas chegam com o módulo PDV.',
    // `contacts.read` porque atender no balcão começa por achar o cliente. Criar/alterar não: o
    // cadastro correto é responsabilidade de quem administra, e um cadastro duplicado feito às
    // pressas no caixa é o começo de duas verdades sobre o mesmo cliente.
    // `products.read` pela mesma razão: não se vende o que não se consegue achar na tela.
    // `contacts.read.all`: o balcão atende qualquer cliente — não faz sentido restringir o caixa a
    // uma carteira.
    permissions: [
      PERMISSIONS.companies.read,
      PERMISSIONS.contacts.read,
      PERMISSIONS.contacts.readAll,
      PERMISSIONS.products.read,
    ],
  },
  {
    code: 'SALES_REP',
    name: 'Representante',
    description: 'Vendedor de rota/consignação. Permissões efetivas chegam com o módulo ROT.',
    // O ÚNICO papel padrão SEM `contacts.read.all` — de propósito. Com a preferência
    // `contact_carteirizacao` LIGADA, este papel passa a ver só os contatos da própria carteira
    // (sales_rep_id = o id do vendedor). Com ela desligada (default), continua vendo todos, como
    // antes. É exatamente aqui que a carteirização (§2.3) muda o efeito deste papel. O filtro é RLS,
    // resolvido por request — ver ADR-0007.
    permissions: [PERMISSIONS.companies.read, PERMISSIONS.contacts.read, PERMISSIONS.products.read],
  },
  {
    code: 'DELIVERY',
    name: 'Entregador',
    description: 'Executa entregas. Permissões efetivas chegam com o módulo ENT.',
    permissions: [PERMISSIONS.companies.read],
  },
  {
    code: 'ACCOUNTANT',
    name: 'Contador',
    description: 'Acesso contábil/fiscal somente leitura. Ampliado com FIS/CTB.',
    permissions: [
      PERMISSIONS.account.read,
      PERMISSIONS.companies.read,
      PERMISSIONS.contacts.read,
      // Contabilidade olha a conta inteira — não é restrito a carteira nenhuma.
      PERMISSIONS.contacts.readAll,
      // NCM, CEST e origem vivem no produto: é leitura de insumo fiscal, não de catálogo comercial.
      PERMISSIONS.products.read,
    ],
  },
];
