import { DomainEvent } from '@gitspread/domain-primitives';

export class ContactImportCompletedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly importId: string,
    public readonly importedCount: number,
    public readonly duplicatedCount: number,
    public readonly invalidCount: number,
    public readonly missingFirstNameCount: number,
  ) {
    super();
  }

  get eventName(): string {
    return 'contact_import.completed';
  }
}
