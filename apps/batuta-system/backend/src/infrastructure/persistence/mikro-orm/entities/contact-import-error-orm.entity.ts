import { Entity, Index, Property } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * Per-row rejection report (6.1 item 3: "relatório por linha").
 *
 * Not in the spec model — added because an operator with a 5.000-line spreadsheet needs to know
 * WHICH lines failed, not just how many.
 *
 * The raw phone is stored MASKED: enough for the operator to recognise the row, never a full number
 * sitting in an error table. The line number is what actually lets them fix the file.
 */
@Entity({ tableName: 'contact_import_errors' })
@Index({ properties: ['contactImportId'] })
export class ContactImportErrorOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'contact_import_id' })
  contactImportId!: string;

  /** 1-based line in the original file, header included, so it matches what the operator sees. */
  @Property({ type: 'int', fieldName: 'line_number' })
  lineNumber!: number;

  @Property({ length: 200 })
  reason!: string;

  @Property({ length: 40, nullable: true, fieldName: 'raw_value_masked' })
  rawValueMasked: string | null = null;
}
