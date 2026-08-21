import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'cut' })
@Index({ name: 'cut_account_id_index', properties: ['accountId'] })
export class CutOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ fieldName: 'reservation_id', type: 'uuid' })
  reservationId!: string;

  /**
   * A matriz declarada que este apontamento executa. **Único** — uma matriz, um apontamento.
   *
   * A garantia está no banco (`cut_one_per_pre_order_item`), não só na aplicação: entre o
   * `select` que não viu apontamento e o `insert` que o cria cabe outra requisição, e dois
   * celulares abertos na mesma reserva é o cenário normal do chão de fábrica.
   */
  @Property({ fieldName: 'pre_order_item_id', type: 'uuid' })
  @Unique({ name: 'cut_one_per_pre_order_item' })
  preOrderItemId!: string;

  @Property({ fieldName: 'marker_name', length: 120, nullable: true })
  markerName: string | null = null;

  /** START: começou o manejo do tecido. */
  @Property({ fieldName: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  /** STOP: a máquina de corte desligou. Nulo enquanto a matriz está em andamento. */
  @Property({ fieldName: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null = null;

  /**
   * Reservados para o import do relatório do Audaces (fase 7). **Ficam nulos nas fases 1–5** — e
   * é por isso que não existe botão de "começou o corte" no app.
   */
  @Property({ fieldName: 'machine_cut_started_at', type: 'timestamptz', nullable: true })
  machineCutStartedAt: Date | null = null;

  @Property({ fieldName: 'machine_cut_ended_at', type: 'timestamptz', nullable: true })
  machineCutEndedAt: Date | null = null;

  @Property({ type: 'int', nullable: true })
  layers: number | null = null;

  @Property({ fieldName: 'nested_pieces', type: 'int', nullable: true })
  nestedPieces: number | null = null;

  /** Derivado — `layers × nested_pieces`. O banco confere com um CHECK. */
  @Property({ fieldName: 'total_pieces', type: 'int', nullable: true })
  totalPieces: number | null = null;

  @Property({ fieldName: 'layout_type', length: 15, nullable: true })
  layoutType: string | null = null;

  @Property({ fieldName: 'fabric_id', type: 'uuid' })
  fabricId!: string;

  @Property({ fieldName: 'product_type_id', type: 'uuid' })
  productTypeId!: string;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
