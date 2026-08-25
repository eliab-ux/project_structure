import { Entity, Index, Property, Unique } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

@Entity({ tableName: 'contacts' })
@Unique({ properties: ['accountId', 'phoneE164'] })
@Index({ properties: ['accountId', 'currentChannelId'] })
@Index({ properties: ['accountId', 'active'] })
export class ContactOrmEntity extends TenantScopedOrmEntity {
  /** E.164 with the leading plus, normalised by the SHARED PhoneE164 — same class the chip uses. */
  @Property({ length: 20, fieldName: 'phone_e164' })
  phoneE164!: string;

  @Property({ length: 200, nullable: true })
  name: string | null = null;

  /** Derived at import and persisted (§6.1 item 5) — never recomputed at send time. */
  @Property({ length: 100, nullable: true, fieldName: 'first_name' })
  firstName: string | null = null;

  @Property({ type: 'json' })
  tags: string[] = [];

  /**
   * THE sender, forever (§1.2). Changed only by an approved migration (§6.4).
   * Indexed because every distribution plan groups contacts by it.
   */
  @Property({ type: 'uuid', fieldName: 'current_channel_id' })
  currentChannelId!: string;

  @Property()
  active: boolean = true;

  /** Set once, never cleared: opt-out is irreversible (§6.5). */
  @Property({ type: 'timestamptz', nullable: true, fieldName: 'opted_out_at' })
  optedOutAt: Date | null = null;

  @Property({ type: 'uuid', nullable: true, fieldName: 'contact_import_id' })
  contactImportId: string | null = null;
}
