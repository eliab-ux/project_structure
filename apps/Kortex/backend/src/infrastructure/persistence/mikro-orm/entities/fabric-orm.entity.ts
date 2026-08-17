import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'fabric' })
@Index({ name: 'fabric_account_id_index', properties: ['accountId'] })
@Unique({ name: 'fabric_account_id_name_unique', properties: ['accountId', 'name'] })
export class FabricOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ length: 120 })
  name!: string;

  /**
   * `numeric(5,2)` chega como string do driver — decimal exato não cabe num double sem
   * aproximar. A conversão para número acontece no mapper, num ponto só.
   */
  @Property({ fieldName: 'max_layer_height_cm', columnType: 'numeric(5,2)' })
  maxLayerHeightCm!: string;

  /**
   * Espessura de UMA camada, em cm. Três casas porque tecido fino se mede em milímetros.
   *
   * Nulo é estado legítimo e permanente: enquanto não estiver medido, o aviso de altura fica em
   * silêncio em vez de comparar com um número inventado.
   */
  @Property({ fieldName: 'layer_thickness_cm', columnType: 'numeric(6,3)', nullable: true })
  layerThicknessCm: string | null = null;

  @Property({ type: 'text', nullable: true })
  notes: string | null = null;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
