import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'resellers' })
export class ResellerOrmEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  @Index()
  userId!: string;

  @Property({ type: 'varchar', length: 255 })
  fullName!: string;

  @Property({ type: 'varchar', unique: true, length: 60 })
  uniqueLink!: string;

  @Property({ type: 'varchar', length: 11, unique: true })
  cpf!: string;

  @Property({ type: 'varchar', length: 2, default: 'pf' })
  type: 'pf' | 'pj' = 'pf';

  @Property({ type: 'date', nullable: true })
  birthDate?: Date | null;

  @Property({ type: 'varchar', length: 9, nullable: true })
  addressZipCode?: string | null;

  @Property({ type: 'varchar', length: 255, nullable: true })
  addressStreet?: string | null;

  @Property({ type: 'varchar', length: 20, nullable: true })
  addressNumber?: string | null;

  @Property({ type: 'varchar', length: 100, nullable: true })
  addressComplement?: string | null;

  @Property({ type: 'varchar', length: 100, nullable: true })
  addressNeighborhood?: string | null;

  @Property({ type: 'varchar', length: 100, nullable: true })
  addressCity?: string | null;

  @Property({ type: 'varchar', length: 2, nullable: true })
  addressState?: string | null;

  @Property({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @Property({ type: 'varchar', length: 20 })
  status!: string;

  @Property({ type: 'varchar', length: 20 })
  level!: string;

  // @Property({ type: 'boolean', default: false })
  // canSetCustomPrice: boolean = false;

  @Property({ type: 'timestamp', nullable: true })
  approvedAt?: Date | null;

  @Property({ type: 'varchar', length: 80, nullable: true })
  approvedBy?: string | null;

  @Property({ type: 'timestamp', nullable: true })
  rejectedAt?: Date | null;

  @Property({ type: 'text', nullable: true })
  rejectedReason?: string | null;

  @Property({ type: 'varchar', length: 100, nullable: true })
  bankName?: string | null;

  @Property({ type: 'varchar', length: 10, nullable: true })
  bankCode?: string | null;

  @Property({ type: 'varchar', length: 20, nullable: true })
  bankAgency?: string | null;

  @Property({ type: 'varchar', length: 30, nullable: true })
  bankAccount?: string | null;

  @Property({ type: 'varchar', length: 20, nullable: true })
  bankAccountType?: string | null;

  @Property({ type: 'varchar', length: 255, nullable: true })
  bankHolderName?: string | null;

  @Property({ type: 'varchar', length: 14, nullable: true })
  bankHolderCpf?: string | null;

  @Property({ type: 'decimal', precision: 12, scale: 2 })
  totalSoldYear: number = 0;

  @Property({ type: 'varchar', length: 255, nullable: true })
  pixKey?: string | null;

  @Property({ type: 'varchar', length: 20, nullable: true })
  pixKeyType?: string | null;

  @Property({ type: 'timestamp', nullable: true })
  suspendedAt?: Date | null;

  @Property({ type: 'varchar', length: 80, nullable: true })
  suspendedBy?: string | null;

  @Property({ type: 'text', nullable: true })
  suspensionReason?: string | null;

  @Property({ type: 'timestamp', onCreate: () => new Date() })
  createdAt!: Date;

  @Property({ type: 'timestamp', onUpdate: () => new Date() })
  updatedAt!: Date;
}
