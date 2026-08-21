import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

/**
 * Uma matriz declarada no pedido (§4.7.1).
 *
 * Tecido, produto e quantidades vivem aqui e **não** mais no `pre_order`: o mesmo cliente traz
 * materiais diferentes na mesma reserva, e sem esta tabela o segundo material não teria onde ser
 * declarado.
 */
@Entity({ tableName: 'pre_order_item' })
@Index({ name: 'pre_order_item_account_id_index', properties: ['accountId'] })
@Index({ name: 'pre_order_item_pre_order_id_index', properties: ['preOrderId'] })
@Unique({ name: 'pre_order_item_sequence_unique', properties: ['preOrderId', 'sequence'] })
export class PreOrderItemOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ fieldName: 'pre_order_id', type: 'uuid' })
  preOrderId!: string;

  /** 1, 2, 3… dentro do pedido. É a ordem que o Modelista vê ao apontar. */
  @Property({ type: 'int' })
  sequence!: number;

  @Property({ fieldName: 'fabric_id', type: 'uuid' })
  fabricId!: string;

  @Property({ fieldName: 'product_type_id', type: 'uuid' })
  productTypeId!: string;

  @Property({ fieldName: 'estimated_pieces', type: 'int' })
  estimatedPieces!: number;

  /** `numeric` chega como string — convertido no mapper, como em `fabric`. */
  @Property({ fieldName: 'meters_per_piece', columnType: 'numeric(8,3)', nullable: true })
  metersPerPiece: string | null = null;

  @Property({ type: 'int', nullable: true })
  rolls: number | null = null;

  @Property({ fieldName: 'estimated_layers', type: 'int', nullable: true })
  estimatedLayers: number | null = null;

  @Property({ fieldName: 'estimated_layout_type', length: 20, nullable: true })
  estimatedLayoutType: string | null = null;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
