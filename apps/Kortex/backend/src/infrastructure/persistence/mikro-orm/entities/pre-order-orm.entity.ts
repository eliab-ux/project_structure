import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'pre_order' })
@Index({ name: 'pre_order_account_id_index', properties: ['accountId'] })
/**
 * O pedido. Tecido, produto e quantidades vivem em `pre_order_item` — uma linha por matriz
 * declarada. Aqui ficam o cliente, as horas do pedido inteiro e a observação.
 */
export class PreOrderOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ fieldName: 'customer_id', type: 'uuid' })
  customerId!: string;

  /** Autoria: é o que prova que o pré-pedido nasceu com o Modelista (regra 6.1). */
  @Property({ fieldName: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Property({ fieldName: 'estimated_hours', type: 'int' })
  estimatedHours!: number;

  @Property({ type: 'text', nullable: true })
  notes: string | null = null;

  @Property({ length: 10 })
  status: string = 'open';

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
