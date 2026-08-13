/**
 * Espelha os ResponseDto do backend para empresa, usuário e papel.
 *
 * Um arquivo só para as três, e não um por entidade, porque elas se referenciam: a tela de usuário
 * precisa da lista de papéis para o seletor, e a de papel precisa do catálogo de permissões. Três
 * arquivos com imports cruzados custariam mais atenção do que as ~90 linhas que estão aqui.
 *
 * Datas chegam como `string` — é o que o JSON entrega. Convertê-las para `Date` no tipo seria uma
 * mentira que só apareceria no primeiro `.getTime()`.
 */

import { BrazilianState } from 'src/constants/brazilianStates';

export type TaxRegime = 'SIMPLES' | 'NORMAL' | 'MEI';

export const TAX_REGIME_LABEL: Record<TaxRegime, string> = {
  SIMPLES: 'Simples Nacional',
  NORMAL: 'Regime Normal',
  MEI: 'MEI',
};

export interface Address {
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  /**
   * A união das 27 UFs, e não `string`.
   *
   * O backend valida com `@IsIn(BRAZILIAN_STATES)` em toda escrita, então nenhuma outra coisa chega
   * a ser gravada — o tipo estreito descreve o dado como ele é. `string` obrigaria um cast toda vez
   * que um valor da API alimentasse o `<select>` de UF, e cast é onde uma suposição vira silêncio.
   */
  state: BrazilianState;
  zipCode: string;
  ibgeCityCode: string | null;
}

export interface StateRegistrationEntry {
  state: BrazilianState;
  registration: string;
}

export interface Company {
  id: string;
  legalName: string;
  tradeName: string | null;
  displayName: string;
  document: string;
  documentFormatted: string;
  stateRegistration: string | null;
  stateRegistrationExempt: boolean;
  municipalRegistration: string | null;
  suframa: string | null;
  cnae: string | null;
  taxRegime: TaxRegime;
  address: Address;
  contactEmail: string | null;
  billingEmail: string | null;
  phone: string | null;
  stateRegistrations: StateRegistrationEntry[];
  active: boolean;
  createdAt: string;
}

export interface CreateCompanyPayload {
  legalName: string;
  tradeName?: string | null;
  document: string;
  taxRegime: TaxRegime;
  stateRegistrationExempt: boolean;
  stateRegistration?: string | null;
  municipalRegistration?: string | null;
  cnae?: string | null;
  address: Address;
  contactEmail?: string | null;
  billingEmail?: string | null;
  phone?: string | null;
}

/** O documento não entra: CNPJ de empresa existente não se edita, se cria outra empresa. */
export type UpdateCompanyPayload = Omit<CreateCompanyPayload, 'document'>;

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleId: string;
  status: 'ACTIVE' | 'DISABLED';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  /** Obrigatório: a recuperação de senha é por código no WhatsApp (CLAUDE.md, regra 9). */
  phone: string;
  password: string;
  roleId: string;
}

/** Sem senha: trocar a senha de outro usuário é outra operação, não uma edição de cadastro. */
export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  roleId?: string;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  isAdministrative: boolean;
}

export interface CreateRolePayload {
  code: string;
  name: string;
  description?: string | null;
  permissions: string[];
}

export type UpdateRolePayload = Partial<Omit<CreateRolePayload, 'code'>>;

export interface PermissionCatalog {
  areas: string[];
  permissions: string[];
}

/**
 * A tradução de uma frase em permissões (§5.1). Espelha `GET /roles/read-phrase` do backend.
 *
 * `undecided` não é "sem resposta" — é a resposta: a frase não falou daquela permissão, e o sistema
 * não supõe. É o estado que a tela é obrigada a exibir, e a razão de ele existir no contrato.
 */
export type PermissionDecision = 'granted' | 'denied' | 'undecided';

export interface PermissionVerdict {
  permission: string;
  decision: PermissionDecision;
  /** Trecho LITERAL da frase que originou a decisão. `null` quando a frase não disse. */
  quote: string | null;
  reason: string;
}

export interface PermissionPhraseReading {
  lines: string[];
  verdicts: PermissionVerdict[];
}
