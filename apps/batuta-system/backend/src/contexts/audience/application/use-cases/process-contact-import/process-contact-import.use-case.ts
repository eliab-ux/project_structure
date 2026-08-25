import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../../../channel/application/ports/output/channel-repository.port';
import { acceptsNewContacts } from '../../../../channel/domain/value-objects/channel-status.vo';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import {
  FILE_STORAGE,
  FileStoragePort,
} from '../../../../../infrastructure/storage/ports/file-storage.port';
import { Contact } from '../../../domain/entities/contact.entity';
import { ChannelAllocator, ChannelLoad } from '../../../domain/services/channel-allocator';
import { AllocationReason } from '../../../domain/value-objects/allocation-reason.vo';
import { ContactImportNotFoundException } from '../../../domain/exceptions/contact-import-not-found.exception';
import { NoEligibleChannelException } from '../../../domain/exceptions/no-eligible-channel.exception';
import { ContactImportDto } from '../../dto/contact.dto';
import {
  CONTACT_FILE_PARSER,
  CONTACT_IMPORT_REPOSITORY,
  CONTACT_SENDER_HISTORY_REPOSITORY,
  ContactFileParserPort,
  ContactImportErrorRecord,
  ContactImportRepositoryPort,
  ContactSenderHistoryRepositoryPort,
  ParsedContactRow,
} from '../../ports/output/contact-import.ports';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { ProcessContactImportCommand } from './process-contact-import.command';

/** Rows per transaction. Small enough that progress moves visibly, big enough to avoid N queries. */
const CHUNK_SIZE = 500;

/** Cap on stored per-row errors. The COUNT is always exact; only the detail list is capped. */
const MAX_STORED_ERRORS = 1_000;

/**
 * Parses the uploaded file and creates the contacts (§6.1). Runs in a BullMQ worker, never in a
 * request.
 *
 * The four rules of §6.1, all enforced here:
 *  3. every phone is normalised to E.164 — a row that does not normalise is `invalid` and reported by
 *     line. A raw phone is NEVER stored;
 *  4. deduplication by (account, phone). An existing contact KEEPS the channel it already had —
 *     "duplicata nunca realoca";
 *  5. `first_name` is derived and persisted, and the misses are counted so the operator learns the
 *     fallback volume before dispatching;
 *  6. provenance was already enforced when the import was created.
 *
 * And §6.2: with no CONNECTED channel the import FAILS with a clear message. It never allocates to a
 * disconnected chip, and it never silently imports contacts with no sender.
 */
@Injectable()
export class ProcessContactImportUseCase implements UseCase<
  ProcessContactImportCommand,
  ContactImportDto
> {
  private readonly logger = new Logger(ProcessContactImportUseCase.name);

  constructor(
    @Inject(CONTACT_IMPORT_REPOSITORY) private readonly imports: ContactImportRepositoryPort,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(CONTACT_SENDER_HISTORY_REPOSITORY)
    private readonly history: ContactSenderHistoryRepositoryPort,
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(CONTACT_FILE_PARSER) private readonly parser: ContactFileParserPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ProcessContactImportCommand): Promise<ContactImportDto> {
    const contactImport = await this.imports.findById(command.importId);
    if (!contactImport) {
      throw new ContactImportNotFoundException();
    }

    try {
      const buffer = await this.storage.getObject(command.accountId, contactImport.storageKey);
      const parsed = await this.parser.parse({
        buffer,
        fileName: contactImport.fileName,
        mimeType: contactImport.fileName.toLowerCase().endsWith('.xlsx')
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv',
        mapping: command.mapping,
        hasHeader: command.hasHeader,
      });

      contactImport.beginProcessing(parsed.rows.length);
      await this.imports.save(contactImport);

      const allocator = await this.buildAllocator();
      if (!allocator.hasEligibleChannel) {
        // §6.2: fail loudly. Importing contacts with no sender would produce a base that can never
        // be messaged and an operator who does not know why.
        throw new NoEligibleChannelException();
      }

      // Phones already seen INSIDE this file: the same number twice in one spreadsheet is a
      // duplicate too, and the database unique key would otherwise abort the whole chunk.
      const seenInFile = new Set<string>();
      let storedErrors = 0;

      for (let offset = 0; offset < parsed.rows.length; offset += CHUNK_SIZE) {
        const chunk = parsed.rows.slice(offset, offset + CHUNK_SIZE);
        const outcome = await this.processChunk(
          command,
          chunk,
          allocator,
          seenInFile,
          MAX_STORED_ERRORS - storedErrors,
        );
        storedErrors += outcome.storedErrors;

        contactImport.recordProgress({
          processedRows: chunk.length,
          imported: outcome.imported,
          duplicated: outcome.duplicated,
          invalid: outcome.invalid,
          missingFirstName: outcome.missingFirstName,
        });
        // Saved per chunk so the progress bar actually moves on a long file.
        await this.imports.save(contactImport);
      }

      contactImport.complete();
      const saved = await this.imports.save(contactImport);
      await this.events.publishAll(contactImport.pullDomainEvents());

      await this.audit.execute({
        accountId: command.accountId,
        actorType: AuditActorType.SYSTEM,
        actorId: null,
        action: AuditAction.CONTACT_IMPORT_COMPLETED,
        entityType: 'contact_import',
        entityId: saved.id,
        payload: {
          imported: saved.importedCount,
          duplicated: saved.duplicatedCount,
          invalid: saved.invalidCount,
          missingFirstName: saved.missingFirstNameCount,
        },
      });

      if (storedErrors >= MAX_STORED_ERRORS && saved.invalidCount > storedErrors) {
        // No silent caps: the count is exact, and the truncation of the DETAIL is stated.
        this.logger.warn('Relatório de erros truncado', {
          importId: saved.id,
          stored: storedErrors,
          total: saved.invalidCount,
        });
      }

      this.logger.log('Importação concluída', {
        importId: saved.id,
        imported: saved.importedCount,
        duplicated: saved.duplicatedCount,
        invalid: saved.invalidCount,
      });

      return ContactImportDto.fromDomain(saved);
    } catch (error) {
      const message = (error as Error)?.message ?? 'Falha ao processar a importação.';
      contactImport.fail(message);
      const failed = await this.imports.save(contactImport);
      this.logger.error('Importação falhou', { importId: contactImport.id, reason: message });
      return ContactImportDto.fromDomain(failed);
    }
  }

  /** Eligible channels and their current loads, ordered by the greedy rule of §6.2. */
  private async buildAllocator(): Promise<ChannelAllocator> {
    const [channels, counts] = await Promise.all([
      this.channels.listByAccount(),
      this.contacts.countByChannel(),
    ]);

    const byChannel = new Map(counts.map((count) => [count.channelId, count.contacts]));

    const eligible: ChannelLoad[] = channels
      // CONNECTED only — never a disconnected or terminal chip (§6.2).
      .filter((channel) => acceptsNewContacts(channel.status))
      .map((channel) => ({
        channelId: channel.id.value,
        allocatedContacts: byChannel.get(channel.id.value) ?? 0,
        createdAt: channel.createdAt,
      }));

    return new ChannelAllocator(eligible);
  }

  private async processChunk(
    command: ProcessContactImportCommand,
    rows: readonly ParsedContactRow[],
    allocator: ChannelAllocator,
    seenInFile: Set<string>,
    errorBudget: number,
  ): Promise<{
    imported: number;
    duplicated: number;
    invalid: number;
    missingFirstName: number;
    storedErrors: number;
  }> {
    const errors: ContactImportErrorRecord[] = [];
    const valid: { row: ParsedContactRow; phone: PhoneE164 }[] = [];
    let duplicated = 0;

    for (const row of rows) {
      if (!row.phone || !row.phone.trim()) {
        errors.push({
          lineNumber: row.lineNumber,
          reason: 'Telefone ausente',
          rawValueMasked: null,
        });
        continue;
      }

      let phone: PhoneE164;
      try {
        phone = PhoneE164.create(row.phone);
      } catch {
        errors.push({
          lineNumber: row.lineNumber,
          reason: 'Telefone não normaliza para E.164',
          // Masked even in the error report: enough to recognise the row, never the full number.
          rawValueMasked: ProcessContactImportUseCase.maskRaw(row.phone),
        });
        continue;
      }

      if (seenInFile.has(phone.value)) {
        duplicated += 1;
        continue;
      }
      seenInFile.add(phone.value);
      valid.push({ row, phone });
    }

    // One query for the whole chunk instead of one per row.
    const existing = await this.contacts.findManyByPhones(valid.map((item) => item.phone.value));
    const existingByPhone = new Map(existing.map((contact) => [contact.phone.value, contact]));

    const created: Contact[] = [];
    const historyEntries: { contactId: string; channelId: string; reason: AllocationReason }[] = [];
    let missingFirstName = 0;

    for (const { row, phone } of valid) {
      const alreadyThere = existingByPhone.get(phone.value);

      if (alreadyThere) {
        // §6.1 item 4: enrich, but NEVER reallocate. The sender of an existing contact is untouched.
        const changed = alreadyThere.enrichFromReimport({ name: row.name, tags: row.tags });
        if (changed) {
          await this.contacts.save(alreadyThere);
        }
        duplicated += 1;
        continue;
      }

      const allocation = allocator.allocateOne();
      const contact = Contact.create({
        accountId: command.accountId,
        phone,
        name: row.name,
        tags: row.tags,
        channelId: allocation.channelId,
        contactImportId: command.importId,
      });

      if (contact.firstName === null) {
        missingFirstName += 1;
      }

      created.push(contact);
      historyEntries.push({
        contactId: contact.id.value,
        channelId: allocation.channelId,
        reason: AllocationReason.INITIAL_ALLOCATION,
      });
    }

    if (created.length > 0) {
      await this.contacts.saveMany(created);
      // §4: never set current_channel_id without writing history.
      await this.history.appendMany(command.accountId, historyEntries);
    }

    const storable = errorBudget > 0 ? errors.slice(0, errorBudget) : [];
    if (storable.length > 0) {
      await this.imports.appendErrors(command.accountId, command.importId, storable);
    }

    return {
      imported: created.length,
      duplicated,
      invalid: errors.length,
      missingFirstName,
      storedErrors: storable.length,
    };
  }

  /** Keeps the shape of the bad value visible without storing a usable number. */
  private static maskRaw(raw: string): string {
    const trimmed = raw.trim().slice(0, 30);
    if (trimmed.length <= 4) {
      return trimmed;
    }
    return `${trimmed.slice(0, 2)}${'*'.repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-2)}`;
  }
}
