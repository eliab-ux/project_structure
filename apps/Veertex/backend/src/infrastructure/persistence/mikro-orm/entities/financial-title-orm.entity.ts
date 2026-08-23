import { Collection, Entity, Index, OneToMany, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';
import { TitleSettlementOrmEntity } from './title-settlement-orm.entity';

/**
 * `financial_titles` (§2.1/§3 do 05) — título a receber/pagar (uma tabela com direção). Tenant, RLS.
 * `status` é gravado (derivado das baixas) para a listagem filtrar sem recalcular.
 */
@Entity({ tableName: 'financial_titles' })
export class FinancialTitleOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ length: 12 })
  direction!: string;

  @Index()
  @Property({ type: 'uuid', fieldName: 'company_id' })
  companyId!: string;

  @Index()
  @Property({ type: 'uuid', nullable: true, fieldName: 'contact_id' })
  contactId: string | null = null;

  @Property({ type: 'uuid', nullable: true, fieldName: 'category_id' })
  categoryId: string | null = null;

  @Property({ length: 200 })
  description!: string;

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Property({ type: 'timestamptz', fieldName: 'issue_date' })
  issueDate: Date = new Date();

  @Index()
  @Property({ type: 'timestamptz', fieldName: 'due_date' })
  dueDate: Date = new Date();

  @Property({ length: 16 })
  origin!: string;

  @Index()
  @Property({ length: 20 })
  status = 'open';

  @OneToMany(() => TitleSettlementOrmEntity, (settlement) => settlement.title)
  settlements = new Collection<TitleSettlementOrmEntity>(this);
}
