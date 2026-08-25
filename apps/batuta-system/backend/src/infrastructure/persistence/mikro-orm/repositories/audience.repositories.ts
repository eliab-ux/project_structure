import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  ContactImportErrorRecord,
  ContactImportRepositoryPort,
  ContactSenderHistoryRepositoryPort,
  SenderHistoryEntry,
  SenderMigrationRepositoryPort,
} from '../../../../contexts/audience/application/ports/output/contact-import.ports';
import { ContactImport } from '../../../../contexts/audience/domain/entities/contact-import.entity';
import { SenderMigration } from '../../../../contexts/audience/domain/entities/sender-migration.entity';
import { AllocationReason } from '../../../../contexts/audience/domain/value-objects/allocation-reason.vo';
import { ContactImportOrmEntity } from '../entities/contact-import-orm.entity';
import { ContactImportErrorOrmEntity } from '../entities/contact-import-error-orm.entity';
import { ContactSenderHistoryOrmEntity } from '../entities/contact-sender-history-orm.entity';
import { SenderMigrationOrmEntity } from '../entities/sender-migration-orm.entity';
import { ContactImportMapper, SenderMigrationMapper } from '../mappers/contact.mapper';

@Injectable()
export class MikroOrmContactImportRepository implements ContactImportRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: ContactImportMapper,
  ) {}

  async findById(id: string): Promise<ContactImport | null> {
    const orm = await this.em.findOne(ContactImportOrmEntity, { id });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async listRecent(limit: number): Promise<ContactImport[]> {
    const rows = await this.em.find(
      ContactImportOrmEntity,
      {},
      { orderBy: { createdAt: 'DESC' }, limit },
    );
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async save(contactImport: ContactImport): Promise<ContactImport> {
    const orm = await this.em.upsert(ContactImportOrmEntity, this.mapper.toOrmData(contactImport));
    await this.em.flush();
    return this.mapper.toDomain(orm);
  }

  async appendErrors(
    accountId: string,
    importId: string,
    errors: readonly ContactImportErrorRecord[],
  ): Promise<void> {
    if (errors.length === 0) {
      return;
    }
    await this.em.insertMany(
      ContactImportErrorOrmEntity,
      errors.map((error) => ({
        id: randomUUID(),
        accountId,
        contactImportId: importId,
        lineNumber: error.lineNumber,
        reason: error.reason.slice(0, 200),
        rawValueMasked: error.rawValueMasked,
        createdAt: new Date(),
      })),
    );
  }

  async listErrors(importId: string, limit: number): Promise<ContactImportErrorRecord[]> {
    const rows = await this.em.find(
      ContactImportErrorOrmEntity,
      { contactImportId: importId },
      { orderBy: { lineNumber: 'ASC' }, limit },
    );
    return rows.map((row) => ({
      lineNumber: row.lineNumber,
      reason: row.reason,
      rawValueMasked: row.rawValueMasked,
    }));
  }
}

/**
 * §4: "Nunca sobrescreva `current_channel_id` sem gravar aqui. Precisa responder 'qual número falou
 * com esta pessoa em março?'"
 *
 * Append-and-close only: rows are inserted on allocation and later CLOSED with `released_at`. There is
 * no update of a channel id and no delete — history is not editable.
 */
@Injectable()
export class MikroOrmContactSenderHistoryRepository implements ContactSenderHistoryRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async appendMany(accountId: string, entries: readonly SenderHistoryEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    const now = new Date();
    await this.em.insertMany(
      ContactSenderHistoryOrmEntity,
      entries.map((entry) => ({
        id: randomUUID(),
        accountId,
        contactId: entry.contactId,
        channelId: entry.channelId,
        assignedAt: now,
        releasedAt: null,
        reason: entry.reason,
        migrationId: entry.migrationId ?? null,
        createdAt: now,
      })),
    );
  }

  async releaseOpenEntries(contactIds: readonly string[], channelId: string): Promise<void> {
    if (contactIds.length === 0) {
      return;
    }
    await this.em.nativeUpdate(
      ContactSenderHistoryOrmEntity,
      { contactId: { $in: [...contactIds] }, channelId, releasedAt: null },
      { releasedAt: new Date() },
    );
  }

  async listForContact(contactId: string): Promise<
    {
      channelId: string;
      assignedAt: Date;
      releasedAt: Date | null;
      reason: AllocationReason;
      migrationId: string | null;
    }[]
  > {
    const rows = await this.em.find(
      ContactSenderHistoryOrmEntity,
      { contactId },
      { orderBy: { assignedAt: 'DESC' } },
    );
    return rows.map((row) => ({
      channelId: row.channelId,
      assignedAt: row.assignedAt,
      releasedAt: row.releasedAt,
      reason: row.reason,
      migrationId: row.migrationId,
    }));
  }
}

@Injectable()
export class MikroOrmSenderMigrationRepository implements SenderMigrationRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: SenderMigrationMapper,
  ) {}

  async findById(id: string): Promise<SenderMigration | null> {
    const orm = await this.em.findOne(SenderMigrationOrmEntity, { id });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async listRecent(limit: number): Promise<SenderMigration[]> {
    const rows = await this.em.find(
      SenderMigrationOrmEntity,
      {},
      { orderBy: { createdAt: 'DESC' }, limit },
    );
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async save(migration: SenderMigration): Promise<SenderMigration> {
    const orm = await this.em.upsert(SenderMigrationOrmEntity, this.mapper.toOrmData(migration));
    await this.em.flush();
    return this.mapper.toDomain(orm);
  }
}
