import { DomainEvent } from '@gitspread/domain-primitives';
import { ContentClassification } from '../value-objects/content-classification.vo';

export class ContentCreatedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly contentId: string,
    public readonly classification: ContentClassification,
    public readonly createdBy: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'content.created';
  }
}
