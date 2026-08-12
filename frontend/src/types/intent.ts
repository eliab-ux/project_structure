/** Espelha o contrato de `/api/intent`, `/api/intent/draft` e `/api/intent/approve`. */

/**
 * De onde veio o valor de um campo (§6.1).
 *
 * `externo` existe no contrato mas **não é produzido nesta fase**: ele marca conteúdo vindo de fonte
 * não confiável (mensagem recebida de terceiro), e ampliar a origem do input para isso exige base
 * legal e aviso na interface — está registrado como gatilho em `DEPENDENCIAS_EXTERNAS.md` §5.
 */
export type FieldOrigin = 'ditado' | 'consulta' | 'padrao' | 'ajustado' | 'externo';

export const ORIGIN_LABEL: Record<FieldOrigin, string> = {
  ditado: 'você escreveu',
  consulta: 'consulta automática',
  padrao: 'padrão da empresa',
  ajustado: 'ajustado por você',
  externo: 'fonte externa',
};

export interface IntentField {
  value: unknown;
  origin: FieldOrigin | null;
  /** `true` = precisa de decisão humana. Campos assim sobem na tela (§6.2). */
  review: boolean;
}

/** Comando reconhecido. `command: null` significa "ainda não sei fazer isso" — e é resposta válida. */
export interface IntentPlan {
  command: string;
  confidence: number;
  fields: Record<string, IntentField>;
  unresolved: string[];
}

export interface IntentNotSupported {
  command: null;
  guess: string | null;
  screenHint: string | null;
}

export type IntentResult = IntentPlan | IntentNotSupported;

export function isSupported(result: IntentResult): result is IntentPlan {
  return result.command !== null;
}

export interface IntentDraft {
  draftId: string;
  command: string;
  label: string;
  fields: Record<string, IntentField>;
  reviewFields: string[];
  approvals: number;
}

export interface ApproveIntentResult {
  draftId: string;
  command: string;
  resourceId: string | null;
  summary: string;
}

/**
 * Rótulo em português de cada campo. O operador não deve ler `stateRegistrationExempt`.
 *
 * Campo sem entrada aqui cai no próprio nome — visível e feio, o que é melhor do que invisível: um
 * campo novo no backend aparece na tela pedindo tradução, em vez de sumir.
 */
export const FIELD_LABEL: Record<string, string> = {
  legalName: 'Razão social',
  tradeName: 'Nome fantasia',
  document: 'CNPJ',
  taxRegime: 'Regime tributário',
  stateRegistrationExempt: 'Isenta de Inscrição Estadual',
  stateRegistration: 'Inscrição Estadual',
  municipalRegistration: 'Inscrição Municipal',
  cnae: 'CNAE',
  address: 'Endereço',
  contactEmail: 'E-mail de contato',
  billingEmail: 'E-mail de cobrança',
  phone: 'Telefone',
  companyId: 'Empresa',
  name: 'Nome',
  email: 'E-mail',
  password: 'Senha inicial',
  roleId: 'Papel',
  userId: 'Usuário',
  code: 'Código',
  description: 'Descrição',
  permissions: 'Permissões',
  moduleCode: 'Módulo',
  active: 'Ativo',
};
