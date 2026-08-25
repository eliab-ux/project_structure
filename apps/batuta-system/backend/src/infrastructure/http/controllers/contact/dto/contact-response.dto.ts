import {
  ChannelLoadDto,
  ContactTagDto,
  ContactDetailDto,
  ContactDto,
  ContactImportDto,
  MigrationPreviewDto,
  SenderMigrationDto,
} from '../../../../../contexts/audience/application/dto/contact.dto';
import { ContactImportReportDto } from '../../../../../contexts/audience/application/use-cases/get-contact-import/get-contact-import.use-case';

export class ContactResponseDto {
  id!: string;
  /** Masked: the operator works by name and tag; a screen full of numbers is an export waiting. */
  phoneMasked!: string;
  name!: string | null;
  firstName!: string | null;
  /** True → this contact will use the merge-field fallback (§7.4). */
  willUseFirstNameFallback!: boolean;
  tags!: string[];
  currentChannelId!: string;
  active!: boolean;
  optedOutAt!: string | null;
  contactImportId!: string | null;
  createdAt!: string;

  static from(contact: ContactDto): ContactResponseDto {
    const dto = new ContactResponseDto();
    dto.id = contact.id;
    dto.phoneMasked = contact.phoneMasked;
    dto.name = contact.name;
    dto.firstName = contact.firstName;
    dto.willUseFirstNameFallback = contact.willUseFirstNameFallback;
    dto.tags = contact.tags;
    dto.currentChannelId = contact.currentChannelId;
    dto.active = contact.active;
    dto.optedOutAt = contact.optedOutAt?.toISOString() ?? null;
    dto.contactImportId = contact.contactImportId;
    dto.createdAt = contact.createdAt.toISOString();
    return dto;
  }
}

export class ContactDetailResponseDto {
  contact!: ContactResponseDto;
  /** Answers "which number spoke to this person in March?" (§4). */
  senderHistory!: {
    channelId: string;
    assignedAt: string;
    releasedAt: string | null;
    reason: string;
    migrationId: string | null;
  }[];

  static from(detail: ContactDetailDto): ContactDetailResponseDto {
    const dto = new ContactDetailResponseDto();
    dto.contact = ContactResponseDto.from(detail.contact);
    dto.senderHistory = detail.senderHistory.map((entry) => ({
      channelId: entry.channelId,
      assignedAt: entry.assignedAt.toISOString(),
      releasedAt: entry.releasedAt?.toISOString() ?? null,
      reason: entry.reason,
      migrationId: entry.migrationId,
    }));
    return dto;
  }
}

export class ContactImportResponseDto {
  id!: string;
  fileName!: string;
  status!: string;
  consentBasis!: string;
  originNote!: string;
  progressPercent!: number;
  totalRows!: number;
  processedRows!: number;
  importedCount!: number;
  duplicatedCount!: number;
  invalidCount!: number;
  /** Shown before any dispatch, per §6.1 item 5. */
  missingFirstNameCount!: number;
  errorMessage!: string | null;
  createdAt!: string;
  finishedAt!: string | null;

  static from(contactImport: ContactImportDto): ContactImportResponseDto {
    const dto = new ContactImportResponseDto();
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
    dto.createdAt = contactImport.createdAt.toISOString();
    dto.finishedAt = contactImport.finishedAt?.toISOString() ?? null;
    // storageKey never crosses this boundary.
    return dto;
  }
}

export class ContactImportReportResponseDto {
  import!: ContactImportResponseDto;
  /** Per-line rejections (§6.1 item 3). The raw value is masked. */
  errors!: { lineNumber: number; reason: string; rawValueMasked: string | null }[];
  errorsTruncated!: boolean;

  static from(report: ContactImportReportDto): ContactImportReportResponseDto {
    const dto = new ContactImportReportResponseDto();
    dto.import = ContactImportResponseDto.from(report.import);
    dto.errors = report.errors.map((error) => ({ ...error }));
    dto.errorsTruncated = report.errorsTruncated;
    return dto;
  }
}

export class ChannelLoadResponseDto {
  channelId!: string;
  channelLabel!: string;
  channelStatus!: string;
  acceptsNewContacts!: boolean;
  contacts!: number;

  static from(load: ChannelLoadDto): ChannelLoadResponseDto {
    const dto = new ChannelLoadResponseDto();
    dto.channelId = load.channelId;
    dto.channelLabel = load.channelLabel;
    dto.channelStatus = load.channelStatus;
    dto.acceptsNewContacts = load.acceptsNewContacts;
    dto.contacts = load.contacts;
    return dto;
  }
}

export class ContactTagResponseDto {
  tag!: string;
  contacts!: number;

  static from(tag: ContactTagDto): ContactTagResponseDto {
    const dto = new ContactTagResponseDto();
    dto.tag = tag.tag;
    dto.contacts = tag.contacts;
    return dto;
  }
}

/** The mandatory preview of §6.4 item 3. */
export class MigrationPreviewResponseDto {
  fromChannelId!: string;
  fromChannelLabel!: string;
  fromChannelStatus!: string;
  strategy!: string;
  toChannelId!: string | null;
  contactsToMigrate!: number;
  loadsBefore!: ChannelLoadResponseDto[];
  loadsAfter!: ChannelLoadResponseDto[];
  /** Non-null → the UI explains why migration is unavailable instead of erroring after a click. */
  blockedReason!: string | null;

  static from(preview: MigrationPreviewDto): MigrationPreviewResponseDto {
    const dto = new MigrationPreviewResponseDto();
    dto.fromChannelId = preview.fromChannelId;
    dto.fromChannelLabel = preview.fromChannelLabel;
    dto.fromChannelStatus = preview.fromChannelStatus;
    dto.strategy = preview.strategy;
    dto.toChannelId = preview.toChannelId;
    dto.contactsToMigrate = preview.contactsToMigrate;
    dto.loadsBefore = preview.loadsBefore.map((load) => ChannelLoadResponseDto.from(load));
    dto.loadsAfter = preview.loadsAfter.map((load) => ChannelLoadResponseDto.from(load));
    dto.blockedReason = preview.blockedReason;
    return dto;
  }
}

export class SenderMigrationResponseDto {
  id!: string;
  fromChannelId!: string;
  strategy!: string;
  toChannelId!: string | null;
  contactsAffected!: number;
  status!: string;
  requestedBy!: string;
  approvedBy!: string;
  executedAt!: string | null;
  failureReason!: string | null;
  createdAt!: string;

  static from(migration: SenderMigrationDto): SenderMigrationResponseDto {
    const dto = new SenderMigrationResponseDto();
    dto.id = migration.id;
    dto.fromChannelId = migration.fromChannelId;
    dto.strategy = migration.strategy;
    dto.toChannelId = migration.toChannelId;
    dto.contactsAffected = migration.contactsAffected;
    dto.status = migration.status;
    dto.requestedBy = migration.requestedBy;
    dto.approvedBy = migration.approvedBy;
    dto.executedAt = migration.executedAt?.toISOString() ?? null;
    dto.failureReason = migration.failureReason;
    dto.createdAt = migration.createdAt.toISOString();
    return dto;
  }
}
