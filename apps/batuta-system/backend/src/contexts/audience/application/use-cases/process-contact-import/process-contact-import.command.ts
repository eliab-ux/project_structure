import { ColumnMapping } from '../../ports/output/contact-import.ports';

export class ProcessContactImportCommand {
  constructor(
    public readonly accountId: string,
    public readonly importId: string,
    public readonly mapping: ColumnMapping,
    public readonly hasHeader: boolean,
  ) {}
}
