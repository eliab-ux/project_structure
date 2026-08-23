import { Entity, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * Crédito do cliente (05 §2.5) — DORMENTE até o FIS: nenhum fluxo grava; o schema nasce pronto para
 * a devolução coordenada entrar sem migração de dados. Ver `CustomerCredit` (domínio).
 */
@Entity({ tableName: 'customer_credits' })
export class CustomerCreditOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'company_id' })
  companyId!: string;

  @Property({ type: 'uuid', fieldName: 'contact_id' })
  contactId!: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'origin_title_id' })
  originTitleId!: string | null;

  @Property({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;

  @Property({ type: 'decimal', precision: 14, scale: 2, fieldName: 'remaining_amount' })
  remainingAmount!: string;

  @Property({ length: 20 })
  status!: string;
}
