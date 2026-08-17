import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'customer' })
@Index({ name: 'customer_account_id_index', properties: ['accountId'] })
@Unique({ name: 'customer_account_id_document_unique', properties: ['accountId', 'document'] })
export class CustomerOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ fieldName: 'account_id', type: 'uuid' })
  accountId!: string;

  @Property({ fieldName: 'legal_name', length: 200 })
  legalName!: string;

  @Property({ fieldName: 'trade_name', length: 200 })
  tradeName!: string;

  @Property({ fieldName: 'document_type', length: 4 })
  documentType!: string;

  /** Só dígitos — é o que o índice único compara. Máscara é apresentação. */
  @Property({ length: 14 })
  document!: string;

  @Property({ fieldName: 'state_registration', length: 30, nullable: true })
  stateRegistration: string | null = null;

  @Property({ fieldName: 'company_size', length: 10, nullable: true })
  companySize: string | null = null;

  @Property({ fieldName: 'employees_count', type: 'int', nullable: true })
  employeesCount: number | null = null;

  @Property({ length: 10 })
  status: string = 'active';

  @Property({ fieldName: 'zip_code', length: 8, nullable: true })
  zipCode: string | null = null;

  @Property({ length: 200, nullable: true })
  street: string | null = null;

  @Property({ length: 20, nullable: true })
  number: string | null = null;

  @Property({ length: 100, nullable: true })
  complement: string | null = null;

  @Property({ length: 100, nullable: true })
  district: string | null = null;

  @Property({ length: 120 })
  city!: string;

  @Property({ columnType: 'char(2)' })
  state!: string;

  @Property({ fieldName: 'rep_name', length: 200 })
  repName!: string;

  @Property({ fieldName: 'rep_role', length: 10, nullable: true })
  repRole: string | null = null;

  /** Dado pessoal sensível: nunca sai em DTO de listagem nem em log (spec §4.4). */
  @Property({ fieldName: 'rep_cpf', length: 11 })
  repCpf!: string;

  @Property({ fieldName: 'rep_phone', length: 20 })
  repPhone!: string;

  @Property({ fieldName: 'rep_email', length: 255 })
  repEmail!: string;

  @Property({ length: 20 })
  whatsapp!: string;

  @Property({ length: 255, nullable: true })
  email: string | null = null;

  @Property({ length: 20, nullable: true })
  phone: string | null = null;

  @Property({ fieldName: 'is_member' })
  isMember: boolean = false;

  /**
   * Coluna `date` (sem hora). O MikroORM a entrega como **string** `'AAAA-MM-DD'`, não como
   * `Date` — e tipá-la como `Date` compila mas explode em runtime no primeiro registro lido do
   * banco, porque o objeto não tem `toISOString`. A conversão para `Date` acontece no mapper.
   */
  @Property({ fieldName: 'member_since', type: 'date', nullable: true })
  memberSince: string | null = null;

  @Property({ type: 'text', nullable: true })
  notes: string | null = null;

  @Property({ fieldName: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Property({ fieldName: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
