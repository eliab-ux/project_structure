import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** `trip_expenses` (§3.5 do 04) — despesa diária da viagem por categoria. Tenant, RLS. */
@Entity({ tableName: 'trip_expenses' })
export class TripExpenseOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'trip_id' })
  tripId!: string;

  @Property({ length: 20 })
  category!: string;

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Property({ type: 'text', nullable: true })
  note: string | null = null;

  @Property({ type: 'timestamptz', fieldName: 'spent_at' })
  spentAt: Date = new Date();
  /** Idempotência do sync de campo — uuid gerado no aparelho; único por conta quando presente. */
  @Property({ type: 'uuid', nullable: true, fieldName: 'client_uuid' })
  clientUuid: string | null = null;

}
