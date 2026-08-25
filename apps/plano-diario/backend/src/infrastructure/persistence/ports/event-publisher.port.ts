import { DomainEvent } from '@gitspread/domain-primitives';

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

export interface EventPublisherPort {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}
