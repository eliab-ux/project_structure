/** Mirrors the backend's ResponseDtos. Kept here so no component declares a shape inline. */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleId: string;
  status: 'ACTIVE' | 'DISABLED';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AccountPreferences {
  allowDuplicateDocument: boolean;
  contactCodeMode: 'manual' | 'sequential';
  productSkuMode: 'manual' | 'sequential';
  /** Carteirização (§2.3 / ADR-0007): vendedor vê só a própria carteira de contatos. */
  contactCarteirizacao: boolean;
  /** Estoque negativo permitido (§3.2 do 03). Default bloquear. */
  stockAllowNegative: boolean;
  /** Vencimento das comissões: fim do período apurado (default) ou dia N do mês seguinte. */
  commissionDueRule: 'last_day_of_period' | 'day_n_next_month';
  commissionDueDay: number;
}

export interface AuthAccount {
  id: string;
  name: string;
  documentFormatted: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  timezone: string;
  cancellationRequestedAt: string | null;
  /** Preferências da conta (§1 do 01A). Vêm no `/auth/me` para a UI ler o valor em vigor. */
  preferences: AccountPreferences;
}

export interface AuthRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  isAdministrative: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
  accountId: string;
  permissions: string[];
  /** `plano ∩ conta` — os módulos que esta conta pode usar agora. */
  modules: string[];
}

export interface AccountModule {
  code: string;
  name: string;
  description: string;
  dependsOn: string[];
  core: boolean;
  availableInPlan: boolean;
  active: boolean;
  /** Módulos ativos que dependem deste — impedem a desativação. */
  blockingDependents: string[];
  /** Dependências inativas — impedem a ativação. */
  missingDependencies: string[];
}

export interface ToggleModuleResponse {
  moduleCode: string;
  active: boolean;
  requiresTokenRefresh: boolean;
}

export interface MeResponse {
  user: AuthUser;
  account: AuthAccount;
  role: AuthRole | null;
  /**
   * Os módulos efetivos da conta (`plano ∩ conta`).
   *
   * Vem daqui, e não do claim do JWT: o access token vive 15 minutos, e é esta rota que o frontend
   * consulta para redesenhar depois de um toggle de módulo. Decodificar o token faria o frontend
   * conhecer o formato interno dele — e trocar o claim quebraria a tela sem nada avisar.
   */
  modules: string[];
}
