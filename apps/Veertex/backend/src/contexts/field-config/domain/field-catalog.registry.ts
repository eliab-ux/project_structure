import {
  CONTACT_FIELD_CATALOG,
  ContactFieldDefinition,
} from '../../contact/domain/contact-field.catalog';
import {
  PRODUCT_FIELD_CATALOG,
  ProductFieldDefinition,
} from '../../product/domain/product-field.catalog';

/**
 * O REGISTRO ÚNICO dos catálogos de campo, por entidade — a fonte que o `field_config` consulta.
 *
 * O §3.6 do CORE fixa o invariante que este arquivo torna mecânico:
 *
 * > *"o catálogo de campos por entidade é FIXO em código (colunas reais); a config só governa
 * > exibição/obrigatoriedade — **nunca cria campo novo**."*
 *
 * Contato e Produto já nasceram com o catálogo declarado campo a campo (ver
 * `contact-field.catalog.ts` e `product-field.catalog.ts`). O `field_config` não os reescreve: ele
 * os LÊ daqui. Um `field_config` que aponte para um par `(entity, field)` ausente deste registro é
 * recusado na ESCRITA — não é ignorado na leitura —, que é o que fecha "nunca cria campo".
 *
 * ## `mandatoryByDomain` — derivado, não redeclarado (DECISÃO 2.1, recomendação)
 *
 * Um campo com `defaultRequired: true` no catálogo é um campo que o DOMÍNIO exige (o VO ou o
 * construtor da entidade recusam a linha sem ele: `types`/`legalName` no Contato, `name`/`unit` no
 * Produto). A config da conta pode exigir MAIS — nunca menos — e não pode ocultar esses campos: uma
 * tela que esconde o documento obrigatório produziria um formulário que o backend sempre recusa.
 * Em vez de uma segunda flag para manter em sincronia, `mandatoryByDomain` é derivado de
 * `defaultRequired`, e a `FieldConfig` usa isso para recusar a config que tentaria afrouxá-lo.
 *
 * ## `order` fora do escopo desta fatia (§3.6 cita `contact`, `product`, `order`)
 *
 * O §3.6 lista `order` entre as entidades cobertas, mas ressalva "(order consome em `02`)". O
 * contexto `order` não existe (é do VND). Ele NÃO é registrado aqui: um `field_config` para
 * `entity = 'order'` é recusado na escrita, exatamente como qualquer entidade desconhecida, até o
 * VND declarar o catálogo do pedido e acrescentá-lo a este registro. É o mesmo invariante aplicado a
 * uma entidade que ainda não nasceu, e não uma exceção a ele.
 */

/** Um campo do catálogo, normalizado — o formato comum às entidades, que o merge e a escrita usam. */
export interface CatalogField {
  field: string;
  label: string;
  /** Bloco/aba da tela, quando a entidade agrupa (Produto). `null` quando não agrupa (Contato). */
  group: string | null;
  defaultVisible: boolean;
  defaultRequired: boolean;
  /**
   * Exigido pela regra de domínio. Derivado de `defaultRequired`: a config não pode ocultar nem
   * tornar opcional um campo assim (DECISÃO 2.1). Ver o docblock do topo.
   */
  mandatoryByDomain: boolean;
  hint?: string;
}

function fromContact(definition: ContactFieldDefinition): CatalogField {
  return {
    field: definition.field,
    label: definition.label,
    group: null,
    defaultVisible: definition.defaultVisible,
    defaultRequired: definition.defaultRequired,
    mandatoryByDomain: definition.defaultRequired,
    hint: definition.hint,
  };
}

function fromProduct(definition: ProductFieldDefinition): CatalogField {
  return {
    field: definition.field,
    label: definition.label,
    group: definition.group,
    defaultVisible: definition.defaultVisible,
    defaultRequired: definition.defaultRequired,
    mandatoryByDomain: definition.defaultRequired,
    hint: definition.hint,
  };
}

/**
 * As entidades que o `field_config` cobre nesta fatia. Ordem estável, para o menu da tela de
 * configuração renderizar sempre igual.
 */
export const CONFIGURABLE_ENTITIES = ['contact', 'product'] as const;
export type ConfigurableEntity = (typeof CONFIGURABLE_ENTITIES)[number];

const CATALOG_BY_ENTITY: Record<ConfigurableEntity, readonly CatalogField[]> = {
  contact: CONTACT_FIELD_CATALOG.map(fromContact),
  product: PRODUCT_FIELD_CATALOG.map(fromProduct),
};

export function isConfigurableEntity(entity: string): entity is ConfigurableEntity {
  return (CONFIGURABLE_ENTITIES as readonly string[]).includes(entity);
}

/** O catálogo da entidade, ou `null` se a entidade não é configurável (desconhecida ou futura). */
export function catalogFor(entity: string): readonly CatalogField[] | null {
  return isConfigurableEntity(entity) ? CATALOG_BY_ENTITY[entity] : null;
}

/** A definição de um campo específico, ou `null` se o par `(entity, field)` não existe no catálogo. */
export function catalogFieldFor(entity: string, field: string): CatalogField | null {
  return catalogFor(entity)?.find((definition) => definition.field === field) ?? null;
}
