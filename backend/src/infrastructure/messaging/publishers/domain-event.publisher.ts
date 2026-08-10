import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '@gitspread/domain-primitives';
import { EventPublisherPort } from '../../persistence/ports/event-publisher.port';

/**
 * In-process domain event publisher. Handlers subscribe with `@OnEvent('account.created')`.
 *
 * Failures are swallowed and logged: a handler that breaks must not roll back the write that
 * already succeeded. An event is a notification that something happened, not part of the decision
 * that it should.
 */
@Injectable()
export class DomainEventPublisher implements EventPublisherPort {
  private readonly logger = new Logger(DomainEventPublisher.name);

  constructor(private readonly emitter: EventEmitter2) {}

  async publish(event: DomainEvent): Promise<void> {
    try {
      await this.emitter.emitAsync(event.eventName, event);
    } catch (error) {
      this.logger.error('Falha ao processar domain event', {
        eventName: event.eventName,
        name: (error as Error)?.name,
        message: (error as Error)?.message,
      });
    }
  }

  async publishAll(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }
}
