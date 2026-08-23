import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';
import { ContactOrmEntity } from './contact-orm.entity';

/**
 * Um endereço de um contato — `main | billing | delivery` (§3.4, "endereços N").
 *
 * `account_id` próprio + policy de RLS própria — ver `ContactEmailOrmEntity`.
 *
 * `latitude`/`longitude`: preenchidas pela PROPAGAÇÃO do GPS do pedido de rota (§3.1 do 04 — a
 * captura da abertura preenche quando vazias; a alteração auditada corrige; ver
 * `MikroOrmContactGeo`). A geocodificação por endereço do §3.4 (BullMQ) segue inexistente.
 */
@Entity({ tableName: 'contact_addresses' })
export class ContactAddressOrmEntity extends TenantScopedOrmEntity {
  @ManyToOne(() => ContactOrmEntity, { fieldName: 'contact_id', deleteRule: 'cascade' })
  contact!: ContactOrmEntity;

  @Property({ length: 20 })
  purpose!: string;

  @Property({ length: 200 })
  street!: string;

  @Property({ length: 20 })
  number!: string;

  @Property({ length: 100, nullable: true })
  complement!: string | null;

  @Property({ length: 100 })
  district!: string;

  @Property({ length: 120 })
  city!: string;

  @Property({ length: 2 })
  state!: string;

  @Property({ length: 8, fieldName: 'zip_code' })
  zipCode!: string;

  @Property({ length: 7, nullable: true, fieldName: 'ibge_city_code' })
  ibgeCityCode!: string | null;

  @Property({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: string | null;

  @Property({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: string | null;
}
