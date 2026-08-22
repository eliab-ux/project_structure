import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * `field_configs` — a sobreposição da conta sobre o catálogo de campos (§3.6).
 *
 * Tabela de TENANT: estende `TenantScopedOrmEntity`, então carrega `account_id` e o filtro global; a
 * migration liga o RLS. **Não guarda o catálogo** — o catálogo é fixo em código. Guarda só o que a
 * conta sobrescreve: visível, obrigatório, rótulo e ordem, por `(entity, field)`.
 */
@Entity({ tableName: 'field_configs' })
@Index({ properties: ['entity'] })
export class FieldConfigOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 40 })
  entity!: string;

  @Property({ length: 80 })
  field!: string;

  @Property()
  visible!: boolean;

  @Property()
  required!: boolean;

  @Property({ length: 100, nullable: true })
  label: string | null = null;

  @Property({ type: 'int', nullable: true, fieldName: 'sort_order' })
  sortOrder: number | null = null;
}
