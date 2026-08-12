import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';
import { PlanLimitsProps } from '../../../../contexts/plan/domain/value-objects/plan-limits.vo';

/**
 * GLOBAL table — the platform's plan catalogue, identical for every tenant, so it carries no
 * `account_id` and does not extend TenantScopedOrmEntity.
 *
 * It still has an RLS policy, because "global" must not mean "unprotected": the runtime role may
 * SELECT and nothing else. Writing the catalogue is an owner operation (migration or seed).
 */
@Entity({ tableName: 'plans' })
export class PlanOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Index()
  @Property({ length: 30, unique: true })
  code!: string;

  @Property({ length: 120 })
  name!: string;

  /**
   * The commercial ceiling: `{ modules[] }` — quais módulos o plano permite. jsonb because every new module
   * or metered resource would otherwise be an ALTER TABLE — and because the shape is owned and
   * validated by the `PlanLimits` value object, not by whoever writes the row.
   */
  @Property({ type: 'json' })
  limits!: PlanLimitsProps;

  @Property({ type: 'boolean' })
  active: boolean = true;

  @Property({ type: 'timestamptz', fieldName: 'created_at' })
  createdAt: Date = new Date();
}
