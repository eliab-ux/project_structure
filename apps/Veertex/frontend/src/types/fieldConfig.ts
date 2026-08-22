/**
 * Personalizar Campos (§3.6). O que a tela de configuração lê e grava. O catálogo continua fixo em
 * código no backend; aqui trafega só a configuração EFETIVA (catálogo + sobreposição da conta).
 */

/** Um campo como a conta o vê, vindo de `GET /field-config/:entity`. */
export interface EffectiveField {
  field: string;
  label: string;
  group: string | null;
  visible: boolean;
  required: boolean;
  order: number | null;
  /** Verdadeiro quando a config não pode ocultá-lo nem torná-lo opcional — a tela trava os toggles. */
  mandatoryByDomain: boolean;
  hint?: string;
  source: 'catalog' | 'account';
}

export interface EntityFieldConfig {
  entity: string;
  fields: EffectiveField[];
}

/** Uma sobreposição enviada em `PUT /field-config/:entity`. */
export interface FieldOverride {
  field: string;
  visible: boolean;
  required: boolean;
  label?: string | null;
  order?: number | null;
}
