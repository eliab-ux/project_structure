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
      PERMISSIONS.companies.update,
      PERMISSIONS.users.read,
      PERMISSIONS.roles.read,
    ],
  },
  {
    code: 'SUPERVISOR',
    name: 'Gerente',
    description: 'Supervisiona loja e rota. Permissões de ROT/VND chegam com esses módulos.',
    permissions: [PERMISSIONS.companies.read, PERMISSIONS.users.read],
  },
  {
    code: 'CASHIER',
    name: 'Operador de Caixa',
    description: 'Opera o PDV. Permissões efetivas chegam com o módulo PDV.',
    permissions: [PERMISSIONS.companies.read],
  },
  {
    code: 'SALES_REP',
    name: 'Representante',
    description: 'Vendedor de rota/consignação. Permissões efetivas chegam com o módulo ROT.',
    permissions: [PERMISSIONS.companies.read],
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
    permissions: [PERMISSIONS.account.read, PERMISSIONS.companies.read],
  },
];
