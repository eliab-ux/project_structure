import { DomainEvent } from '@veertex/domain-primitives';

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

/** Domain events are published by repositories AFTER successful persistence (CLAUDE.md). */
export interface EventPublisherPort {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}
