import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** `trip_collections` (§3.4 do 04) — carteira da viagem: título × viagem, cobrança|recobrança. */
@Entity({ tableName: 'trip_collections' })
export class TripCollectionOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'trip_id' })
  tripId!: string;

  @Index()
  @Property({ type: 'uuid', fieldName: 'title_id' })
  titleId!: string;

  @Property({ length: 12 })
  kind!: string;

  /** Saldo do título congelado na montagem — o denominador da razão da comissão B. */
  @Property({ type: 'numeric', precision: 14, scale: 2, fieldName: 'amount_at_build' })
  amountAtBuild!: string;
}
