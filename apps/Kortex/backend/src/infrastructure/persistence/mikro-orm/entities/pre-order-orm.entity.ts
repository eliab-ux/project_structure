import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'pre_order' })
@Index({ name: 'pre_order_account_id_index', properties: ['accountId'] })
export class PreOrderOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ fieldName: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Property({ fieldName: 'fabric_id', type: 'uuid' })
  fabricId!: string;

  @Property({ fieldName: 'product_type_id', type: 'uuid' })
  productTypeId!: string;

  /** Autoria: é o que prova que o pré-pedido nasceu com o Modelista (regra 6.1). */
  @Property({ fieldName: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Property({ fieldName: 'estimated_pieces', type: 'int' })
  estimatedPieces!: number;

  /** `numeric` chega como string — convertido no mapper, como em `fabric`. */
  @Property({ fieldName: 'meters_per_piece', columnType: 'numeric(8,3)', nullable: true })
  metersPerPiece: string | null = null;

  @Property({ type: 'int', nullable: true })
  rolls: number | null = null;

  @Property({ fieldName: 'estimated_layers', type: 'int', nullable: true })
  estimatedLayers: number | null = null;

  @Property({ fieldName: 'estimated_layout_type', length: 15, nullable: true })
  estimatedLayoutType: string | null = null;

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
