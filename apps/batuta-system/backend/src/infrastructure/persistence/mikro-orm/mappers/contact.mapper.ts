import { Injectable } from '@nestjs/common';
import { Contact } from '../../../../contexts/audience/domain/entities/contact.entity';
import { ContactImport } from '../../../../contexts/audience/domain/entities/contact-import.entity';
import { SenderMigration } from '../../../../contexts/audience/domain/entities/sender-migration.entity';
import { ContactId } from '../../../../contexts/audience/domain/value-objects/contact-id.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { ContactOrmEntity } from '../entities/contact-orm.entity';
import { ContactImportOrmEntity } from '../entities/contact-import-orm.entity';
import { SenderMigrationOrmEntity } from '../entities/sender-migration-orm.entity';

@Injectable()
export class ContactMapper {
  toDomain(orm: ContactOrmEntity): Contact {
    return Contact.reconstitute({
      id: ContactId.from(orm.id),
      accountId: orm.accountId,
      phone: PhoneE164.create(orm.phoneE164),
      name: orm.name,
      firstName: orm.firstName,
      tags: [...(orm.tags ?? [])],
      currentChannelId: orm.currentChannelId,
      active: orm.active,
      optedOutAt: orm.optedOutAt,
      contactImportId: orm.contactImportId,
      createdAt: orm.createdAt,
    });
  }

  toOrmData(contact: Contact): Record<string, unknown> {
    return {
      id: contact.id.value,
      accountId: contact.accountId,
      phoneE164: contact.phone.value,
      name: contact.name,
      firstName: contact.firstName,
      tags: [...contact.tags],
      currentChannelId: contact.currentChannelId,
      active: contact.active,
      optedOutAt: contact.optedOutAt,
      contactImportId: contact.contactImportId,
      createdAt: contact.createdAt,
    };
  }
}

@Injectable()
export class ContactImportMapper {
  toDomain(orm: ContactImportOrmEntity): ContactImport {
    return ContactImport.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      fileName: orm.fileName,
      storageKey: orm.storageKey,
      uploadedBy: orm.uploadedBy,
      consentBasis: orm.consentBasis,
      originNote: orm.originNote,
      status: orm.status,
      totalRows: orm.totalRows,
      processedRows: orm.processedRows,
      importedCount: orm.importedCount,
      duplicatedCount: orm.duplicatedCount,
      invalidCount: orm.invalidCount,
      missingFirstNameCount: orm.missingFirstNameCount,
      errorMessage: orm.errorMessage,
      createdAt: orm.createdAt,
      finishedAt: orm.finishedAt,
    });
  }

  toOrmData(contactImport: ContactImport): Record<string, unknown> {
    return {
      id: contactImport.id,
      accountId: contactImport.accountId,
      fileName: contactImport.fileName,
      storageKey: contactImport.storageKey,
      uploadedBy: contactImport.uploadedBy,
      consentBasis: contactImport.consentBasis,
      originNote: contactImport.originNote,
      status: contactImport.status,
      totalRows: contactImport.totalRows,
      processedRows: contactImport.processedRows,
      importedCount: contactImport.importedCount,
      duplicatedCount: contactImport.duplicatedCount,
      invalidCount: contactImport.invalidCount,
      missingFirstNameCount: contactImport.missingFirstNameCount,
      errorMessage: contactImport.errorMessage,
      createdAt: contactImport.createdAt,
      finishedAt: contactImport.finishedAt,
    };
  }
}

@Injectable()
export class SenderMigrationMapper {
  toDomain(orm: SenderMigrationOrmEntity): SenderMigration {
    return SenderMigration.reconstitute({
      id: orm.id,
      accountId: orm.accountId,
      fromChannelId: orm.fromChannelId,
      strategy: orm.strategy,
      toChannelId: orm.toChannelId,
      contactsAffected: orm.contactsAffected,
      requestedBy: orm.requestedBy,
      approvedBy: orm.approvedBy,
      status: orm.status,
      executedAt: orm.executedAt,
      failureReason: orm.failureReason,
      createdAt: orm.createdAt,
    });
  }

  toOrmData(migration: SenderMigration): Record<string, unknown> {
    return {
      id: migration.id,
      accountId: migration.accountId,
      fromChannelId: migration.fromChannelId,
      strategy: migration.strategy,
      toChannelId: migration.toChannelId,
      contactsAffected: migration.contactsAffected,
      requestedBy: migration.requestedBy,
      approvedBy: migration.approvedBy,
      status: migration.status,
      executedAt: migration.executedAt,
      failureReason: migration.failureReason,
      createdAt: migration.createdAt,
    };
  }
}
