import { AllocationReason } from '../../../domain/value-objects/allocation-reason.vo';
import { ContactImport } from '../../../domain/entities/contact-import.entity';
import { SenderMigration } from '../../../domain/entities/sender-migration.entity';

export const CONTACT_IMPORT_REPOSITORY = Symbol('CONTACT_IMPORT_REPOSITORY');
export const CONTACT_SENDER_HISTORY_REPOSITORY = Symbol('CONTACT_SENDER_HISTORY_REPOSITORY');
export const SENDER_MIGRATION_REPOSITORY = Symbol('SENDER_MIGRATION_REPOSITORY');
export const CONTACT_FILE_PARSER = Symbol('CONTACT_FILE_PARSER');
export const PENDING_DISPATCH_RESOLVER = Symbol('PENDING_DISPATCH_RESOLVER');
export const CONVERSATION_MIGRATOR = Symbol('CONVERSATION_MIGRATOR');

export interface ContactImportErrorRecord {
  lineNumber: number;
  reason: string;
  /** Masked — an error table never holds a full phone number. */
  rawValueMasked: string | null;
}

export interface ContactImportRepositoryPort {
  findById(id: string): Promise<ContactImport | null>;
  listRecent(limit: number): Promise<ContactImport[]>;
  save(contactImport: ContactImport): Promise<ContactImport>;
  appendErrors(
    accountId: string,
    importId: string,
    errors: readonly ContactImportErrorRecord[],
  ): Promise<void>;
  listErrors(importId: string, limit: number): Promise<ContactImportErrorRecord[]>;
}

export interface SenderHistoryEntry {
  contactId: string;
  channelId: string;
  reason: AllocationReason;
  migrationId?: string | null;
}

/**
 * §4: "Nunca sobrescreva `current_channel_id` sem gravar aqui." The two methods mirror that: opening
 * a stay and closing the previous one are the same transaction as the change itself.
 */
export interface ContactSenderHistoryRepositoryPort {
  /** Opens a stay for each contact. */
  appendMany(accountId: string, entries: readonly SenderHistoryEntry[]): Promise<void>;
  /** Closes the open stay of these contacts on a channel (sets released_at). */
  releaseOpenEntries(contactIds: readonly string[], channelId: string): Promise<void>;
  /** Full history of one contact, most recent first — answers "who spoke to this person in March?". */
  listForContact(contactId: string): Promise<
    {
      channelId: string;
      assignedAt: Date;
      releasedAt: Date | null;
      reason: AllocationReason;
      migrationId: string | null;
    }[]
  >;
}

export interface SenderMigrationRepositoryPort {
  findById(id: string): Promise<SenderMigration | null>;
  listRecent(limit: number): Promise<SenderMigration[]>;
  save(migration: SenderMigration): Promise<SenderMigration>;
}

export interface ParsedContactRow {
  /** 1-based line in the original file, header included, matching what the operator sees. */
  lineNumber: number;
  phone: string | null;
  name: string | null;
  tags: string[];
}

export interface ContactFileParseResult {
  rows: ParsedContactRow[];
  /** Header names found, so the UI can offer a column mapping (§6.1 item 2). */
  detectedColumns: string[];
}

export interface ColumnMapping {
  /** Mandatory (§6.1 item 2). Header name, or a 0-based index when the file has no header. */
  phone: string;
  name?: string | null;
  /** A single column holding comma- or semicolon-separated tags. */
  tags?: string | null;
}

/**
 * Parses a CSV/XLSX buffer into rows. Format detection is the adapter's problem; the application
 * only ever sees rows.
 */
export interface ContactFileParserPort {
  parse(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    mapping: ColumnMapping;
    hasHeader: boolean;
  }): Promise<ContactFileParseResult>;
}

/**
 * §6.4 item 5: "Dispatches pendentes do canal morto: resolver explicitamente — reatribuir ao novo
 * remetente ou CANCELLED com motivo. Nunca deixe dispatch órfão apontando para canal terminal."
 *
 * `dispatches` only exists from FASE 6/7, so this phase ships the SEAM and a no-op adapter that
 * logs. The migration calls it unconditionally, so when the real implementation lands there is
 * nothing to remember to wire — and until then the obligation is visible in code rather than in
 * someone's memory.
 */
export interface PendingDispatchResolverPort {
  /** @returns how many pending dispatches were re-pointed or cancelled. */
  resolveForMigration(input: {
    accountId: string;
    fromChannelId: string;
    migrationId: string;
    /** contactId → new channel, so a pending dispatch can follow its contact. */
    reassignments: ReadonlyMap<string, string>;
  }): Promise<number>;
}

/**
 * §6.4 item 6: open conversations of the dead channel move with their contacts, while `messages`
 * keeps the original `channel_id` of each message. Same seam reasoning as above — `conversations`
 * arrives in FASE 8.
 */
export interface ConversationMigratorPort {
  /** @returns how many conversations were re-homed. */
  migrateForChannel(input: {
    accountId: string;
    fromChannelId: string;
    reassignments: ReadonlyMap<string, string>;
  }): Promise<number>;
}
