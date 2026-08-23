import { Entity, Index, ManyToOne, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';
import { FinancialTitleOrmEntity } from './financial-title-orm.entity';

/**
 * `title_settlements` (§2.1 do 05) — baixas do título, **append-only** (grant sem update/delete).
 * Filha de TENANT com policy PRÓPRIA (RLS não segue JOIN): carrega `account_id`.
 */
@Entity({ tableName: 'title_settlements' })
export class TitleSettlementOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @ManyToOne(() => FinancialTitleOrmEntity, { fieldName: 'title_id', deleteRule: 'cascade' })
  title!: FinancialTitleOrmEntity;

  @Index()
  @Property({ type: 'uuid', fieldName: 'financial_account_id' })
  financialAccountId!: string;

  @Property({ length: 16 })
  method!: string;

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  principal!: string;

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  interest = '0';

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  fine = '0';

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  discount = '0';

  @Property({ type: 'timestamptz', fieldName: 'settled_at' })
  settledAt: Date = new Date();
}
