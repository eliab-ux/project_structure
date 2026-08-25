import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  FILE_STORAGE,
  FileStoragePort,
} from '../../../../../infrastructure/storage/ports/file-storage.port';
import { ContactImport } from '../../../domain/entities/contact-import.entity';
import { ContactImportDto } from '../../dto/contact.dto';
import {
  CONTACT_IMPORT_REPOSITORY,
  ContactImportRepositoryPort,
} from '../../ports/output/contact-import.ports';
import { StartContactImportCommand } from './start-contact-import.command';

/** Guards against a base64 blob big enough to be an attack rather than a contact list. */
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

/**
 * Accepts the file and hands the work to a job (§6.1 items 1 and 7).
 *
 * Order: validate provenance → store the original in MinIO → record the import → enqueue. The file is
 * kept because it IS the evidence of where the list came from; an import row saying
 * "PUBLIC_SOURCE / lista do site X" with no file is a claim, not a record.
 *
 * Nothing is parsed here. A 20.000-line spreadsheet parsed in the request would time out the browser
 * and hold a connection for minutes — §6.1 item 7 is explicit: "nunca no request".
 */
@Injectable()
export class StartContactImportUseCase implements UseCase<
  StartContactImportCommand,
  ContactImportDto
> {
  private readonly logger = new Logger(StartContactImportUseCase.name);

  constructor(
    @Inject(CONTACT_IMPORT_REPOSITORY) private readonly imports: ContactImportRepositoryPort,
    @Inject(FILE_STORAGE) private readonly storage: FileStoragePort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: StartContactImportCommand): Promise<ContactImportDto> {
    if (!ALLOWED_MIME.has(command.fileMimeType)) {
      throw new Error(`Tipo de arquivo não suportado: ${command.fileMimeType}. Envie CSV ou XLSX.`);
    }

    const buffer = Buffer.from(command.fileBase64, 'base64');
    if (buffer.length === 0) {
      throw new Error('Arquivo vazio.');
    }
    if (buffer.length > MAX_FILE_BYTES) {
      throw new Error('Arquivo maior que 15 MB. Divida a lista em partes.');
    }

    const extension = command.fileName.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv';
    const storageKey = `contact-imports/${randomUUID()}.${extension}`;

    await this.storage.putObject({
      accountId: command.accountId,
      key: storageKey,
      body: buffer,
      mimeType: command.fileMimeType,
    });

    // Throws MissingProvenanceException when consent basis or origin note are absent (§6.1 item 6).
    const contactImport = ContactImport.start({
      accountId: command.accountId,
      fileName: command.fileName,
      storageKey,
      uploadedBy: command.performedBy,
      consentBasis: command.consentBasis,
      originNote: command.originNote,
    });

    const saved = await this.imports.save(contactImport);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CONTACT_IMPORT_STARTED,
      entityType: 'contact_import',
      entityId: saved.id,
      ip: command.ip,
      // Provenance in the trail: this is what answers "where did this list come from?".
      payload: {
        fileName: saved.fileName,
        consentBasis: saved.consentBasis,
        originNote: saved.originNote,
      },
    });

    this.logger.log('Importação de contatos registrada', {
      importId: saved.id,
      accountId: command.accountId,
    });

    return ContactImportDto.fromDomain(saved);
  }
}
