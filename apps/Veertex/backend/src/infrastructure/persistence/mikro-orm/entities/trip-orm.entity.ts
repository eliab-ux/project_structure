import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** `trips` (§2 do 04) — a viagem: rota × representante, caixa, km, status. Tenant, RLS. */
@Entity({ tableName: 'trips' })
export class TripOrmEntity extends TenantScopedOrmEntity {
  @Index()
  @Property({ type: 'uuid', fieldName: 'company_id' })
  companyId!: string;

  @Index()
  @Property({ type: 'uuid', fieldName: 'route_id' })
  routeId!: string;

  @Index()
  @Property({ type: 'uuid', fieldName: 'sales_rep_id' })
  salesRepId!: string;

  @Property({ type: 'uuid', nullable: true, fieldName: 'helper_user_id' })
  helperUserId: string | null = null;

  @Index()
  @Property({ length: 20 })
  status = 'planejada';

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'departure_at' })
  departureAt: Date | null = null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'return_at' })
  returnAt: Date | null = null;

  @Property({ type: 'numeric', precision: 14, scale: 2, fieldName: 'initial_cash' })
  initialCash = '0';

  @Property({ type: 'numeric', precision: 14, scale: 2, nullable: true, fieldName: 'return_cash' })
  returnCash: string | null = null;

  @Property({ type: 'numeric', precision: 12, scale: 1, nullable: true, fieldName: 'initial_km' })
  initialKm: string | null = null;

  @Property({ type: 'numeric', precision: 12, scale: 1, nullable: true, fieldName: 'final_km' })
  finalKm: string | null = null;

  /** Localização `rep_load` (03A) onde a carga da viagem vive; criada na primeira carga. */
  @Property({ type: 'uuid', nullable: true, fieldName: 'load_location_id' })
  loadLocationId: string | null = null;

  // ── Inputs/resultados do FECHAMENTO persistidos: o batimento é reproduzível dos dados gravados ──
  @Property({ type: 'uuid', nullable: true, fieldName: 'closure_manager_user_id' })
  closureManagerUserId: string | null = null;

  @Property({
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    fieldName: 'closure_manager_percent',
  })
  closureManagerPercent: string | null = null;

  @Property({
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    fieldName: 'closure_helper_amount',
  })
  closureHelperAmount: string | null = null;

  /** % da faixa B aplicada no fechamento — congela a folha contra mudança futura das faixas. */
  @Property({
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    fieldName: 'closure_commission_percent',
  })
  closureCommissionPercent: string | null = null;

  @Property({
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    fieldName: 'closure_rep_commission',
  })
  closureRepCommission: string | null = null;
}
