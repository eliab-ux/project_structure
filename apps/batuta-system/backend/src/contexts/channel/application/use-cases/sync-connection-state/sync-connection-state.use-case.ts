import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import {
  GatewayConnectionState,
  WHATSAPP_GATEWAY,
  WhatsAppGatewayPort,
} from '../../../../../infrastructure/whatsapp/ports/whatsapp-gateway.port';
import { ChannelId } from '../../../domain/value-objects/channel-id.vo';
import { ChannelNotFoundException } from '../../../domain/exceptions/channel-not-found.exception';
import { ChannelDto } from '../../dto/channel.dto';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../ports/output/channel-repository.port';
import { SyncConnectionStateCommand } from './sync-connection-state.command';

/**
 * Reconciles our stored status with what the Evolution instance actually reports.
 *
 * Exists because a webhook can be missed — the server restarts, the network blips, the instance was
 * created before the webhook was configured. Polling on demand (the pairing screen) and on a
 * schedule keeps `channels.status` honest.
 *
 * Like the webhook, it NEVER promotes a channel to a terminal state: an instance reported as MISSING
 * means "re-provision me", not "this number is banned" (§4, §5 FASE 2 item 4).
 */
@Injectable()
export class SyncConnectionStateUseCase implements UseCase<SyncConnectionStateCommand, ChannelDto> {
  private readonly logger = new Logger(SyncConnectionStateUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGatewayPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
  ) {}

  async execute(command: SyncConnectionStateCommand): Promise<ChannelDto> {
    const channel = await this.channels.findById(ChannelId.from(command.channelId));
    if (!channel) {
      throw new ChannelNotFoundException();
    }

    // A terminal channel is not reconciled: its state is a human declaration, not the server's
    // opinion, and its instance may legitimately no longer exist.
    if (channel.isTerminal) {
      return ChannelDto.fromDomain(channel);
    }

    const instance = {
      instanceName: channel.evolutionInstanceName,
      accountId: channel.accountId,
    };

    // Re-asserts the webhook before reading the state, and this is the self-healing part.
    //
    // The webhook is registered when the instance is CREATED, so an instance born while
    // EVOLUTION_WEBHOOK_URL was missing or still held a placeholder stays deaf forever: it sends
    // fine, but acks, inbound messages and disconnections never arrive. Fixing the variable does not
    // fix the instance already on the server, and the damage is not cosmetic — with no acks the
    // throttle reads 0% delivery and drops every channel to its quota floor.
    //
    // Doing it here means the operator's "Sincronizar" (and the 15-minute cron) repairs it, instead of
    // the chip needing to be deleted and paired again. It never fails the reconciliation: the gateway
    // returns false and logs.
    await this.gateway.ensureWebhook(instance);

    const state = await this.gateway.getConnectionState(instance);

    switch (state) {
      case GatewayConnectionState.OPEN:
        channel.markConnected();
        break;
      case GatewayConnectionState.CLOSED:
      case GatewayConnectionState.MISSING:
        channel.markDisconnected(
          state === GatewayConnectionState.MISSING ? 'instância ausente no servidor' : null,
        );
        break;
      case GatewayConnectionState.CONNECTING:
      default:
        // Mid-handshake: not a state change, and treating it as a disconnect would inflate the
        // disconnect_events signal that the throttle reads.
        break;
    }

    const saved = await this.channels.save(channel);
    await this.events.publishAll(channel.pullDomainEvents());

    this.logger.debug('Estado de conexão sincronizado', {
      channelId: saved.id.value,
      status: saved.status,
    });
    return ChannelDto.fromDomain(saved);
  }
}
