import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { ThrottleConfig } from '../../../../../config/throttle.config';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import { ChannelId } from '../../../domain/value-objects/channel-id.vo';
import { ChannelNotFoundException } from '../../../domain/exceptions/channel-not-found.exception';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../ports/output/channel-repository.port';
import { RegisterSendOutcomeCommand } from './register-send-outcome.command';

/**
 * Circuit breaker per channel (§10, FASE 7 item 7): N consecutive failures degrade the channel and
 * pause its queue.
 *
 * It lives here in FASE 2 because `consecutive_failures` and the DEGRADED transition belong to the
 * channel, and the breaker must not be reinvented inside the dispatch worker. The CALLER arrives
 * with FASE 7 — until then this use case is exercised only by tests.
 *
 * It never escalates to BANNED: a tripped breaker means "a person should look", not "this number is
 * gone" (§4).
 */
@Injectable()
export class RegisterSendOutcomeUseCase implements UseCase<RegisterSendOutcomeCommand, void> {
  private readonly logger = new Logger(RegisterSendOutcomeUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly throttleConfig: ThrottleConfig,
  ) {}

  async execute(command: RegisterSendOutcomeCommand): Promise<void> {
    const channel = await this.channels.findById(ChannelId.from(command.channelId));
    if (!channel) {
      throw new ChannelNotFoundException();
    }

    if (command.succeeded) {
      channel.registerSendSuccess();
    } else {
      const tripped = channel.registerSendFailure(
        this.throttleConfig.circuitBreakerFailureThreshold,
      );
      if (tripped) {
        this.logger.error('Circuit breaker acionado: canal degradado', {
          channelId: channel.id.value,
          consecutiveFailures: channel.consecutiveFailures,
        });
      }
    }

    await this.channels.save(channel);
    await this.events.publishAll(channel.pullDomainEvents());
  }
}
