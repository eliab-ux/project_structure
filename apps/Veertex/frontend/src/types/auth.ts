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

export interface AuthAccount {
  id: string;
  name: string;
  documentFormatted: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  timezone: string;
  cancellationRequestedAt: string | null;
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
}
