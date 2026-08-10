import { Entity, Enum, Index, Property, Unique } from '@mikro-orm/core';
import { TaxRegime } from '../../../../contexts/company/domain/value-objects/tax-regime.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/** Shape of one entry in `st_registrations`. Validated by the `StateRegistration` value object. */
export interface StateRegistrationRow {
  state: string;
  registration: string;
}

@Entity({ tableName: 'companies' })
@Unique({ properties: ['accountId', 'document'] })
export class CompanyOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 200, fieldName: 'legal_name' })
  legalName!: string;

  @Property({ length: 200, nullable: true, fieldName: 'trade_name' })
  tradeName: string | null = null;

  /** CNPJ, digits only. Unique per account — two companies cannot share one. */
  @Index()
  @Property({ length: 14 })
  document!: string;

  @Property({ length: 30, nullable: true, fieldName: 'state_registration' })
  stateRegistration: string | null = null;

  @Property({ type: 'boolean', fieldName: 'state_registration_exempt' })
  stateRegistrationExempt: boolean = false;

  @Property({ length: 30, nullable: true, fieldName: 'municipal_registration' })
  municipalRegistration: string | null = null;

  @Property({ length: 30, nullable: true })
  suframa: string | null = null;

  @Property({ length: 10, nullable: true })
  cnae: string | null = null;

  @Enum({ items: () => TaxRegime, fieldName: 'tax_regime' })
  taxRegime!: TaxRegime;

  // ==== Endereço (mapeado coluna a coluna, não jsonb) ====
  // Flat columns because the address is queried and reported on — city, UF and the IBGE code all
  // end up in fiscal documents and in analytics filters, and a jsonb blob would make every one of
  // those a functional index.
  @Property({ length: 200, fieldName: 'address_street' })
  addressStreet!: string;

  @Property({ length: 20, fieldName: 'address_number' })
  addressNumber!: string;

  @Property({ length: 100, nullable: true, fieldName: 'address_complement' })
  addressComplement: string | null = null;

  @Property({ length: 100, fieldName: 'address_district' })
  addressDistrict!: string;

  @Property({ length: 120, fieldName: 'address_city' })
  addressCity!: string;

  @Property({ length: 2, fieldName: 'address_state' })
  addressState!: string;

  @Property({ length: 8, fieldName: 'address_zip_code' })
  addressZipCode!: string;

  /** IBGE municipality code — required by NF-e. Nullable so a company can be created before it is
   * looked up, but every entry point asks for it (see the Address value object). */
  @Property({ length: 7, nullable: true, fieldName: 'address_ibge_city_code' })
  addressIbgeCityCode: string | null = null;

  @Property({ length: 255, nullable: true, fieldName: 'contact_email' })
  contactEmail: string | null = null;

  @Property({ length: 255, nullable: true, fieldName: 'billing_email' })
  billingEmail: string | null = null;

  @Property({ length: 20, nullable: true })
  phone: string | null = null;

  /**
   * IEs de substituto tributário, one per UF.
   *
   * jsonb rather than a child table, and this is NOT the EAV pattern CLAUDE.md forbids: the shape
   * is fixed (`{state, registration}`), owned and validated by a value object, and read only as a
   * whole with its company. A child table would add a second RLS-protected table, a second mapper
   * and a populate on every company read, to model a list that is edited as a set and never joined.
   */
  @Property({ type: 'json', fieldName: 'st_registrations' })
  stRegistrations: StateRegistrationRow[] = [];

  /** MinIO object key. Upload lands with the storage slice; the column exists so it need not move. */
  @Property({ length: 300, nullable: true, fieldName: 'logo_object_key' })
  logoObjectKey: string | null = null;

  @Property({ type: 'boolean' })
  active: boolean = true;
}
