import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '@gitspread/domain-primitives';
import { EventPublisherPort } from '../../persistence/ports/event-publisher.port';

@Injectable()
export class DomainEventPublisher implements EventPublisherPort {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publish(event: DomainEvent): Promise<void> {
    // Publish in-process event
    this.eventEmitter.emit(event.eventName, event);

    // TODO: Add external message broker publishing here (RabbitMQ, Kafka, etc)
    // await this.messageQueue.publish('domain.events', event.eventName, event);
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    await Promise.all(events.map((event) => this.publish(event)));
  }
}
