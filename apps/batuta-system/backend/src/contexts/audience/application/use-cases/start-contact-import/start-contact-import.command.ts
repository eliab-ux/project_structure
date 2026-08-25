import { ConsentBasis } from '../../../domain/value-objects/consent-basis.vo';
import { ColumnMapping } from '../../ports/output/contact-import.ports';

export class StartContactImportCommand {
  constructor(
    public readonly accountId: string,
    public readonly performedBy: string,
    public readonly fileName: string,
    public readonly fileMimeType: string,
    /** Base64 in JSON — Fastify, never multipart (CLAUDE.md). */
    public readonly fileBase64: string,
    public readonly consentBasis: ConsentBasis,
    public readonly originNote: string,
    public readonly mapping: ColumnMapping,
    public readonly hasHeader: boolean,
    public readonly ip: string | null,
  ) {}
}
