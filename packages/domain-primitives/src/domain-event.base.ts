import { randomUUID } from 'crypto';

export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly occurredAt: Date;

  constructor() {
    this.eventId = randomUUID();
    this.occurredAt = new Date();
  }

  abstract get eventName(): string;
}
