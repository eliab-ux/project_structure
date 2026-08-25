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
import { RetireChannelCommand } from './retire-channel.command';

/**
 * Retires a chip on purpose (§5, FASE 2 item 5). Terminal, human-only, ACCOUNT_ADMIN, with a
 * mandatory reason recorded in `terminal_reason` and in the audit trail.
 *
 * After this, the channel's contacts become migratable (§6.4) — which is precisely why the state is
 * reachable only from here and from `markBanned`, and never from a webhook or a job.
 */
@Injectable()
export class RetireChannelUseCase implements UseCase<RetireChannelCommand, ChannelDto> {
  private readonly logger = new Logger(RetireChannelUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGatewayPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: RetireChannelCommand): Promise<ChannelDto> {
    const channel = await this.channels.findById(ChannelId.from(command.channelId));
    if (!channel) {
      throw new ChannelNotFoundException();
    }

    channel.retire(command.performedBy, command.reason);
    const saved = await this.channels.save(channel);

    // Best effort: freeing the instance on the Evolution server is housekeeping, and a server that
    // is down must not block the operator from retiring a chip they no longer control.
    try {
      await this.gateway.deleteInstance({
        instanceName: saved.evolutionInstanceName,
        accountId: saved.accountId,
      });
    } catch (error) {
      this.logger.warn('Canal aposentado, mas a instância não pôde ser removida na Evolution', {
        channelId: saved.id.value,
        error: (error as Error)?.message,
      });
    }

    await this.events.publishAll(channel.pullDomainEvents());

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CHANNEL_RETIRED,
      entityType: 'channel',
      entityId: saved.id.value,
      ip: command.ip,
      payload: { reason: command.reason, label: saved.label },
    });

    this.logger.warn('Canal aposentado', { channelId: saved.id.value });
    return ChannelDto.fromDomain(saved);
  }
}
