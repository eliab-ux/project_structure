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

/** Espelha `GET /contacts` — §3.4 do CORE. */
export type ContactType = 'customer' | 'supplier' | 'carrier' | 'reseller';
export type PersonKind = 'individual' | 'company';

export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  customer: 'Cliente',
  supplier: 'Fornecedor',
  carrier: 'Transportadora',
  reseller: 'Revendedor',
};

export interface Contact {
  id: string;
  types: ContactType[];
  personKind: PersonKind;
  legalName: string;
  tradeName: string | null;
  displayName: string;
  document: string | null;
  documentFormatted: string | null;
  documentType: string | null;
  stateRegistration: string | null;
  code: string | null;
  /** Registrado; o bloqueio é aplicado no VND ao confirmar o pedido (§2.2). */
  creditLimit: number | null;
  /** Vendedor vinculado (carteirização, §2.3 / ADR-0007). `null` = sem carteira. */
  salesRepId: string | null;
  notes: string | null;
  municipalRegistration: string | null;
  suframa: string | null;
  gln: string | null;
  pixKey: string | null;
  website: string | null;
  emails: { email: string; label: string | null }[];
  phones: { phone: string; masked: string; label: string | null; isWhatsapp: boolean }[];
  addresses: {
    purpose: 'main' | 'billing' | 'delivery';
    street: string;
    number: string;
    complement: string | null;
    district: string;
    city: string;
    state: string;
    zipCode: string;
    ibgeCityCode: string | null;
    latitude: number | null;
    longitude: number | null;
  }[];
  active: boolean;
}

/**
 * O catálogo de campos, vindo do backend (§3.6: fixo em código, nunca no banco) **já mesclado com a
 * configuração da conta** (`field_config`). Por isso `visible`/`required` são os valores EFETIVOS —
 * o default do catálogo já sobreposto pela config da conta, quando há. A tela não mantém cópia.
 */
export interface ContactFieldDefinition {
  field: string;
  label: string;
  rule: 'base' | 'optional';
  /** Valor efetivo (catálogo + config da conta), não o default cru. */
  visible: boolean;
  required: boolean;
  /** Ordem preferida pela conta; `null` = ordem do catálogo. */
  order?: number | null;
  /** Obrigatório por regra de domínio — a config não consegue ocultá-lo nem torná-lo opcional. */
  mandatoryByDomain?: boolean;
  /** Texto de apoio exibido abaixo do campo. É por aqui que o aviso do limite de crédito chega. */
  hint?: string;
}

export interface CreateContactPayload {
  types: ContactType[];
  personKind: PersonKind;
  legalName: string;
  tradeName?: string | null;
  document?: string | null;
  creditLimit?: number | null;
  salesRepId?: string | null;
  notes?: string | null;
  emails?: { email: string; label?: string | null }[];
  phones?: { phone: string; label?: string | null; isWhatsapp?: boolean }[];
}

export type UpdateContactPayload = Partial<CreateContactPayload> & { active?: boolean };
