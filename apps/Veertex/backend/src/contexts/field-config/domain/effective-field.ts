import { catalogFor, CatalogField } from './field-catalog.registry';
import { FieldConfig } from './entities/field-config.entity';

/**
 * O campo COMO A CONTA o vê — catálogo mesclado com a configuração. É o que a tela consome para
 * montar o formulário, e o que a checagem de obrigatoriedade lê para saber o que exigir.
 */
export interface EffectiveField {
  field: string;
  label: string;
  group: string | null;
  visible: boolean;
  required: boolean;
  /** Ordem de exibição. `null` = sem preferência da conta; a tela mantém a ordem do catálogo. */
  order: number | null;
  /** Verdadeiro quando a config não pode afrouxá-lo (DECISÃO 2.1). A tela desabilita os toggles. */
  mandatoryByDomain: boolean;
  hint?: string;
  /** De onde veio o valor efetivo — `catalog` (default) ou `account` (há linha de config). */
  source: 'catalog' | 'account';
}

/**
 * A regra de precedência do §3.6, num só lugar e pura (testável sem banco):
 *
 *  - **Config da conta sobrescreve o default do catálogo** — `visible`, `required`, `label`, `order`.
 *  - **Campo sem linha de config usa o default do catálogo** (decisão (b), já tomada no Contato).
 *  - **Campo obrigatório por domínio nunca é afrouxado**: mesmo que uma linha inválida tivesse
 *    escapado para o banco, o merge força `visible`/`required` de volta a `true`. A `FieldConfig`
 *    já recusa criar essa linha; esta é a segunda camada, no caminho da LEITURA (Defense in Depth).
 *
 * A ordem de saída segue o catálogo (a ordem em que os campos foram declarados), que é a ordem que a
 * tela deve manter quando a conta não pediu outra.
 */
export function mergeEffectiveFields(
  entity: string,
  configs: readonly FieldConfig[],
): EffectiveField[] {
  const catalog = catalogFor(entity);
  if (!catalog) {
    return [];
  }

  const byField = new Map<string, FieldConfig>();
  for (const config of configs) {
    // Só configs desta entidade contam; um repositório correto já filtra, mas o merge não confia
    // na origem dos dados que recebe.
    if (config.entity === entity) {
      byField.set(config.field, config);
    }
  }

  return catalog.map((definition) => toEffective(definition, byField.get(definition.field)));
}

function toEffective(definition: CatalogField, config: FieldConfig | undefined): EffectiveField {
  const base: EffectiveField = {
    field: definition.field,
    label: definition.label,
    group: definition.group,
    visible: definition.defaultVisible,
    required: definition.defaultRequired,
    order: null,
    mandatoryByDomain: definition.mandatoryByDomain,
    hint: definition.hint,
    source: 'catalog',
  };

  if (!config) {
    return base;
  }

  const merged: EffectiveField = {
    ...base,
    label: config.label ?? definition.label,
    visible: config.visible,
    required: config.required,
    order: config.sortOrder,
    source: 'account',
  };

  // Rede de segurança na leitura: um campo obrigatório por domínio permanece visível e obrigatório
  // aconteça o que acontecer com a linha de config.
  if (definition.mandatoryByDomain) {
    merged.visible = true;
    merged.required = true;
  }

  return merged;
}
