import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { ChannelId } from '../../../domain/value-objects/channel-id.vo';
import { ChannelNotFoundException } from '../../../domain/exceptions/channel-not-found.exception';
import { ChannelDto } from '../../dto/channel.dto';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../ports/output/channel-repository.port';
import { ReinstateChannelCommand } from './reinstate-channel.command';

/**
 * Lifts a DEGRADED channel after a human looked at it.
 *
 * Why the human step exists: DEGRADED is what the system does when it stopped trusting the channel
 * (throttle PAUSE or tripped circuit breaker). Recovering automatically would put the chip straight
 * back into the traffic that degraded it. It returns as DISCONNECTED — the next connection event
 * decides the rest — and its quota starts again from the floor.
 */
@Injectable()
export class ReinstateChannelUseCase implements UseCase<ReinstateChannelCommand, ChannelDto> {
  private readonly logger = new Logger(ReinstateChannelUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ReinstateChannelCommand): Promise<ChannelDto> {
    const channel = await this.channels.findById(ChannelId.from(command.channelId));
    if (!channel) {
      throw new ChannelNotFoundException();
    }

    channel.reinstate();
    const saved = await this.channels.save(channel);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CHANNEL_REINSTATED,
      entityType: 'channel',
      entityId: saved.id.value,
      ip: command.ip,
    });

    this.logger.log('Canal reabilitado', { channelId: saved.id.value });
    return ChannelDto.fromDomain(saved);
  }
}
