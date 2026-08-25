import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import {
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
import { DisconnectChannelCommand } from './disconnect-channel.command';

/**
 * Logs the chip out of its Evolution instance. TRANSIENT on purpose: this is how an operator
 * re-pairs a chip on another phone, and it must never look like retirement.
 *
 * Consequence to keep in mind: a disconnected channel does NOT enable contact migration (§6.4).
 */
@Injectable()
export class DisconnectChannelUseCase implements UseCase<DisconnectChannelCommand, ChannelDto> {
  private readonly logger = new Logger(DisconnectChannelUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGatewayPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: DisconnectChannelCommand): Promise<ChannelDto> {
    const channel = await this.channels.findById(ChannelId.from(command.channelId));
    if (!channel) {
      throw new ChannelNotFoundException();
    }

    await this.gateway.logout({
      instanceName: channel.evolutionInstanceName,
      accountId: channel.accountId,
    });

    channel.markDisconnected('logout solicitado pelo operador');
    const saved = await this.channels.save(channel);
    await this.events.publishAll(channel.pullDomainEvents());

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CHANNEL_DISCONNECTED,
      entityType: 'channel',
      entityId: saved.id.value,
      ip: command.ip,
    });

    this.logger.log('Canal desconectado por solicitação', { channelId: saved.id.value });
    return ChannelDto.fromDomain(saved);
  }
}
