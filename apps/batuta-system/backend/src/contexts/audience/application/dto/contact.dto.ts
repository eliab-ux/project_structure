import { Contact } from '../../domain/entities/contact.entity';
import { ContactImport } from '../../domain/entities/contact-import.entity';
import { SenderMigration } from '../../domain/entities/sender-migration.entity';
import { ConsentBasis } from '../../domain/value-objects/consent-basis.vo';
import { ImportStatus } from '../../domain/value-objects/import-status.vo';
import {
  MigrationStatus,
  MigrationStrategy,
} from '../../domain/value-objects/migration-strategy.vo';

/**
 * Application view of a contact.
 *
 * The phone is MASKED. That is a real decision, not caution: the operator works by name and tag, the
 * dispatch works by id, and a screen that lists thousands of full numbers is an export waiting to
 * happen. The full number exists in the database and in the send path, nowhere else.
 */
export class ContactDto {
  id!: string;
  phoneMasked!: string;
  name!: string | null;
  firstName!: string | null;
  /** Null firstName means this contact will hit the merge-field fallback (§7.4). */
  willUseFirstNameFallback!: boolean;
  tags!: string[];
  currentChannelId!: string;
  active!: boolean;
  optedOutAt!: Date | null;
  contactImportId!: string | null;
  createdAt!: Date;

  static fromDomain(contact: Contact): ContactDto {
    const dto = new ContactDto();
    dto.id = contact.id.value;
    dto.phoneMasked = contact.phone.masked;
    dto.name = contact.name;
    dto.firstName = contact.firstName;
    dto.willUseFirstNameFallback = contact.firstName === null;
    dto.tags = [...contact.tags];
    dto.currentChannelId = contact.currentChannelId;
    dto.active = contact.active;
    dto.optedOutAt = contact.optedOutAt;
    dto.contactImportId = contact.contactImportId;
    dto.createdAt = contact.createdAt;
    return dto;
  }
}

export class ContactImportDto {
  id!: string;
  fileName!: string;
  status!: ImportStatus;
  consentBasis!: ConsentBasis;
  originNote!: string;
  progressPercent!: number;
  totalRows!: number;
  processedRows!: number;
  importedCount!: number;
  duplicatedCount!: number;
  invalidCount!: number;
  /** The number the operator must see BEFORE dispatching (§6.1 item 5 → §7.4). */
  missingFirstNameCount!: number;
  errorMessage!: string | null;
  createdAt!: Date;
  finishedAt!: Date | null;

  static fromDomain(contactImport: ContactImport): ContactImportDto {
    const dto = new ContactImportDto();
    dto.id = contactImport.id;
    dto.fileName = contactImport.fileName;
    dto.status = contactImport.status;
    dto.consentBasis = contactImport.consentBasis;
    dto.originNote = contactImport.originNote;
    dto.progressPercent = contactImport.progressPercent;
    dto.totalRows = contactImport.totalRows;
    dto.processedRows = contactImport.processedRows;
    dto.importedCount = contactImport.importedCount;
    dto.duplicatedCount = contactImport.duplicatedCount;
    dto.invalidCount = contactImport.invalidCount;
    dto.missingFirstNameCount = contactImport.missingFirstNameCount;
    dto.errorMessage = contactImport.errorMessage;
    dto.createdAt = contactImport.createdAt;
    dto.finishedAt = contactImport.finishedAt;
    // storageKey is intentionally absent: it is infrastructure, and the file is downloaded through
    // a signed URL, never by a client-supplied key.
    return dto;
  }
}

/** Contacts carried by one channel — the "carga por canal" screen and the allocator's input. */
export class ChannelLoadDto {
  channelId!: string;
  channelLabel!: string;
  channelStatus!: string;
  /** Whether this channel is eligible to receive newly imported contacts (§6.2). */
  acceptsNewContacts!: boolean;
  contacts!: number;
}

/** One tag of the base, with the audience it currently reaches. */
export class ContactTagDto {
  tag!: string;
  /** Routable contacts only: a tag whose contacts all opted out reaches nobody. */
  contacts!: number;
}

export class SenderMigrationDto {
  id!: string;
  fromChannelId!: string;
  strategy!: MigrationStrategy;
  toChannelId!: string | null;
  contactsAffected!: number;
  status!: MigrationStatus;
  requestedBy!: string;
  approvedBy!: string;
  executedAt!: Date | null;
  failureReason!: string | null;
  createdAt!: Date;

  static fromDomain(migration: SenderMigration): SenderMigrationDto {
    const dto = new SenderMigrationDto();
    dto.id = migration.id;
    dto.fromChannelId = migration.fromChannelId;
    dto.strategy = migration.strategy;
    dto.toChannelId = migration.toChannelId;
    dto.contactsAffected = migration.contactsAffected;
    dto.status = migration.status;
    dto.requestedBy = migration.requestedBy;
    dto.approvedBy = migration.approvedBy;
    dto.executedAt = migration.executedAt;
    dto.failureReason = migration.failureReason;
    dto.createdAt = migration.createdAt;
    return dto;
  }
}

/** The mandatory preview of §6.4 item 3: how many move, and the load per channel before/after. */
export class MigrationPreviewDto {
  fromChannelId!: string;
  fromChannelLabel!: string;
  fromChannelStatus!: string;
  strategy!: MigrationStrategy;
  toChannelId!: string | null;
  contactsToMigrate!: number;
  loadsBefore!: ChannelLoadDto[];
  loadsAfter!: ChannelLoadDto[];
  /** Present when the plan cannot run — e.g. no eligible destination. Never a silent failure. */
  blockedReason!: string | null;
}

/** One stay of a contact with a channel — answers "which number spoke to this person in March?". */
export class SenderHistoryEntryDto {
  channelId!: string;
  assignedAt!: Date;
  releasedAt!: Date | null;
  reason!: string;
  migrationId!: string | null;
}

export class ContactDetailDto {
  contact!: ContactDto;
  senderHistory!: SenderHistoryEntryDto[];
}
