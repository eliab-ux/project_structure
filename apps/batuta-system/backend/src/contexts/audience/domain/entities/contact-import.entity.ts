import { randomUUID } from 'crypto';
import { AggregateRoot } from '@gitspread/domain-primitives';
import { ConsentBasis } from '../value-objects/consent-basis.vo';
import { ImportStatus } from '../value-objects/import-status.vo';
import { MissingProvenanceException } from '../exceptions/missing-provenance.exception';
import { ContactImportCompletedEvent } from '../events/contact-import-completed.event';

/** Minimum length that makes `origin_note` an actual answer rather than a checkbox. */
const MIN_ORIGIN_NOTE = 10;

/**
 * One import run and its report (§6.1).
 *
 * The counters are the deliverable, not bookkeeping: `missing_first_name_count` tells the operator
 * how many contacts will fall back on the merge field BEFORE they dispatch (§7.4), and
 * `invalid_count` plus the per-row report is how a bad spreadsheet gets fixed.
 */
export class ContactImport extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private readonly _accountId: string,
    private readonly _fileName: string,
    private readonly _storageKey: string,
    private readonly _uploadedBy: string,
    private readonly _consentBasis: ConsentBasis,
    private readonly _originNote: string,
    private _status: ImportStatus,
    private _totalRows: number,
    private _processedRows: number,
    private _importedCount: number,
    private _duplicatedCount: number,
    private _invalidCount: number,
    private _missingFirstNameCount: number,
    private _errorMessage: string | null,
    private readonly _createdAt: Date,
    private _finishedAt: Date | null,
  ) {
    super();
  }

  static start(params: {
    accountId: string;
    fileName: string;
    storageKey: string;
    uploadedBy: string;
    consentBasis: ConsentBasis;
    originNote: string;
  }): ContactImport {
    // §6.1 item 6: an import without provenance is REJECTED. Enforced in the domain so no entry
    // point can skip it.
    const originNote = (params.originNote ?? '').trim();
    if (!params.consentBasis || originNote.length < MIN_ORIGIN_NOTE) {
      throw new MissingProvenanceException();
    }

    return new ContactImport(
      randomUUID(),
      params.accountId,
      params.fileName,
      params.storageKey,
      params.uploadedBy,
      params.consentBasis,
      originNote,
      ImportStatus.PENDING,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      new Date(),
      null,
    );
  }

  static reconstitute(params: {
    id: string;
    accountId: string;
    fileName: string;
    storageKey: string;
    uploadedBy: string;
    consentBasis: ConsentBasis;
    originNote: string;
    status: ImportStatus;
    totalRows: number;
    processedRows: number;
    importedCount: number;
    duplicatedCount: number;
    invalidCount: number;
    missingFirstNameCount: number;
    errorMessage: string | null;
    createdAt: Date;
    finishedAt: Date | null;
  }): ContactImport {
    return new ContactImport(
      params.id,
      params.accountId,
      params.fileName,
      params.storageKey,
      params.uploadedBy,
      params.consentBasis,
      params.originNote,
      params.status,
      params.totalRows,
      params.processedRows,
      params.importedCount,
      params.duplicatedCount,
      params.invalidCount,
      params.missingFirstNameCount,
      params.errorMessage,
      params.createdAt,
      params.finishedAt,
    );
  }

  get id(): string {
    return this._id;
  }

  get accountId(): string {
    return this._accountId;
  }

  get fileName(): string {
    return this._fileName;
  }

  get storageKey(): string {
    return this._storageKey;
  }

  get uploadedBy(): string {
    return this._uploadedBy;
  }

  get consentBasis(): ConsentBasis {
    return this._consentBasis;
  }

  get originNote(): string {
    return this._originNote;
  }

  get status(): ImportStatus {
    return this._status;
  }

  get totalRows(): number {
    return this._totalRows;
  }

  get processedRows(): number {
    return this._processedRows;
  }

  get importedCount(): number {
    return this._importedCount;
  }

  get duplicatedCount(): number {
    return this._duplicatedCount;
  }

  get invalidCount(): number {
    return this._invalidCount;
  }

  /** How many imported contacts have no usable first name — the §7.4 warning, before dispatch. */
  get missingFirstNameCount(): number {
    return this._missingFirstNameCount;
  }

  get errorMessage(): string | null {
    return this._errorMessage;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get finishedAt(): Date | null {
    return this._finishedAt;
  }

  /** 0–100, for the progress bar the operator watches. */
  get progressPercent(): number {
    if (this._totalRows === 0) {
      return this._status === ImportStatus.COMPLETED ? 100 : 0;
    }
    return Math.min(100, Math.round((this._processedRows / this._totalRows) * 100));
  }

  beginProcessing(totalRows: number): void {
    this._status = ImportStatus.PROCESSING;
    this._totalRows = totalRows;
  }

  /** Called per batch so the operator sees movement on a long file. */
  recordProgress(counters: {
    processedRows: number;
    imported: number;
    duplicated: number;
    invalid: number;
    missingFirstName: number;
  }): void {
    this._processedRows += counters.processedRows;
    this._importedCount += counters.imported;
    this._duplicatedCount += counters.duplicated;
    this._invalidCount += counters.invalid;
    this._missingFirstNameCount += counters.missingFirstName;
  }

  complete(): void {
    this._status = ImportStatus.COMPLETED;
    this._finishedAt = new Date();
    this.addDomainEvent(
      new ContactImportCompletedEvent(
        this._accountId,
        this._id,
        this._importedCount,
        this._duplicatedCount,
        this._invalidCount,
        this._missingFirstNameCount,
      ),
    );
  }

  /** Parsing failed, or there was no eligible channel (§6.2). The message reaches the operator. */
  fail(message: string): void {
    this._status = ImportStatus.FAILED;
    this._errorMessage = message.slice(0, 500);
    this._finishedAt = new Date();
  }
}
