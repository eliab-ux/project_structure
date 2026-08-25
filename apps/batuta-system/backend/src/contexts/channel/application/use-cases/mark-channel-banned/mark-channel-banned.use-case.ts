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
import { ChannelId } from '../../../domain/value-objects/channel-id.vo';
import { ChannelNotFoundException } from '../../../domain/exceptions/channel-not-found.exception';
import { ChannelDto } from '../../dto/channel.dto';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../ports/output/channel-repository.port';
import { MarkChannelBannedCommand } from './mark-channel-banned.command';

/**
 * A HUMAN declares that WhatsApp banned this number.
 *
 * There is no automatic detection of a ban and there must not be: WhatsApp never tells you
 * (§2.1). What the system observes is a delivery rate collapsing, and that produces LOWER or PAUSE —
 * never BANNED. Someone has to pick up the phone, see the block, and record it here.
 *
 * The instance is deliberately NOT deleted: a banned number's session is evidence, and the operator
 * may still want to open it to confirm. Retirement is what cleans up.
 */
@Injectable()
export class MarkChannelBannedUseCase implements UseCase<MarkChannelBannedCommand, ChannelDto> {
  private readonly logger = new Logger(MarkChannelBannedUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: MarkChannelBannedCommand): Promise<ChannelDto> {
    const channel = await this.channels.findById(ChannelId.from(command.channelId));
    if (!channel) {
      throw new ChannelNotFoundException();
    }

    channel.declareBanned(command.performedBy, command.reason);
    const saved = await this.channels.save(channel);

    await this.events.publishAll(channel.pullDomainEvents());

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CHANNEL_BANNED,
      entityType: 'channel',
      entityId: saved.id.value,
      ip: command.ip,
      payload: { reason: command.reason, label: saved.label },
    });

    this.logger.warn('Canal declarado banido', { channelId: saved.id.value });
    return ChannelDto.fromDomain(saved);
  }
}
