import { Entity, Enum, Index, Property } from '@mikro-orm/core';
import { ConsentBasis } from '../../../../contexts/audience/domain/value-objects/consent-basis.vo';
import { ImportStatus } from '../../../../contexts/audience/domain/value-objects/import-status.vo';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

@Entity({ tableName: 'contact_imports' })
@Index({ properties: ['accountId', 'createdAt'] })
export class ContactImportOrmEntity extends TenantScopedOrmEntity {
  @Property({ length: 300, fieldName: 'file_name' })
  fileName!: string;

  /** Object key in the account's MinIO bucket. The original file is kept as evidence of provenance. */
  @Property({ length: 500, fieldName: 'storage_key' })
  storageKey!: string;

  @Property({ type: 'uuid', fieldName: 'uploaded_by' })
  uploadedBy!: string;

  /** §6.1 item 6: mandatory, no default. Without these two, the import is rejected. */
  @Enum({ items: () => ConsentBasis, fieldName: 'consent_basis' })
  consentBasis!: ConsentBasis;

  @Property({ length: 500, fieldName: 'origin_note' })
  originNote!: string;

  /** Not in §4 — needed because §6.1 item 7 requires a job "com progresso". */
  @Enum({ items: () => ImportStatus })
  status!: ImportStatus;

  @Property({ type: 'int', fieldName: 'total_rows' })
  totalRows: number = 0;

  @Property({ type: 'int', fieldName: 'processed_rows' })
  processedRows: number = 0;

  @Property({ type: 'int', fieldName: 'imported_count' })
  importedCount: number = 0;

  @Property({ type: 'int', fieldName: 'duplicated_count' })
  duplicatedCount: number = 0;

  @Property({ type: 'int', fieldName: 'invalid_count' })
  invalidCount: number = 0;

  /** How many contacts will hit the merge-field fallback — the §7.4 warning, before dispatch. */
  @Property({ type: 'int', fieldName: 'missing_first_name_count' })
  missingFirstNameCount: number = 0;

  @Property({ length: 500, nullable: true, fieldName: 'error_message' })
  errorMessage: string | null = null;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'finished_at' })
  finishedAt: Date | null = null;
}
