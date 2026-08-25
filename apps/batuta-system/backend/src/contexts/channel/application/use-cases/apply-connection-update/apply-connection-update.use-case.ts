import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import { GatewayConnectionState } from '../../../../../infrastructure/whatsapp/ports/whatsapp-gateway.port';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../ports/output/channel-repository.port';
import { ApplyConnectionUpdateCommand } from './apply-connection-update.command';

/**
 * Applies one connection-state change coming from the Evolution webhook (§5, FASE 2 item 4).
 *
 * Two hard rules, both enforced here rather than trusted to the caller:
 *
 *  1. **The webhook never promotes a channel to `BANNED` or `RETIRED`.** Whatever the provider says
 *     — instance deleted, session logged out, number unreachable — the worst this produces is
 *     `DISCONNECTED`. Terminal states are human declarations (§4), and an automatic ban would make
 *     100 contacts migratable because a phone lost signal.
 *  2. **A channel already in a terminal state is left alone.** Its status is a human record, not the
 *     provider's opinion, and a late webhook must not resurrect it.
 *
 * It resolves the channel by INSTANCE NAME, which carries the tenant (`acct-{account}-ch-{channel}`),
 * so a spoofed payload cannot reach another tenant's channel by guessing an id.
 */
@Injectable()
export class ApplyConnectionUpdateUseCase implements UseCase<ApplyConnectionUpdateCommand, void> {
  private readonly logger = new Logger(ApplyConnectionUpdateUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
  ) {}

  async execute(command: ApplyConnectionUpdateCommand): Promise<void> {
    const channel = await this.channels.findById(command.channelId);

    if (!channel) {
      // Unknown instance: either another system shares this Evolution server, or the channel was
      // deleted. Not an error, and nothing to do.
      this.logger.warn('Webhook de conexão para canal desconhecido', {
        instance: command.instanceName,
      });
      return;
    }

    if (channel.isTerminal) {
      this.logger.debug('Webhook ignorado: canal em estado terminal', {
        channelId: channel.id.value,
        status: channel.status,
      });
      return;
    }

    switch (command.state) {
      case GatewayConnectionState.OPEN:
        channel.markConnected();
        break;
      case GatewayConnectionState.CLOSED:
      case GatewayConnectionState.MISSING:
        // The ceiling of what a webhook may do: DISCONNECTED, never terminal.
        channel.markDisconnected(command.reason);
        break;
      case GatewayConnectionState.CONNECTING:
      default:
        // Mid-handshake is not a state change; counting it would inflate disconnect_events.
        return;
    }

    const saved = await this.channels.save(channel);
    await this.events.publishAll(channel.pullDomainEvents());

    this.logger.log('Estado de conexão atualizado por webhook', {
      channelId: saved.id.value,
      status: saved.status,
    });
  }
}
