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
import { UpdateQuotaBandCommand } from './update-quota-band.command';

/**
 * The operator adjusts the BAND (floor and ceiling), never the current quota (§2.1).
 *
 * There is no endpoint that sets `current_quota`, and this use case cannot either: it calls
 * `changeQuotaBand`, which only re-clamps the current value into the new band. Raising the ceiling
 * therefore does not hand the channel a jump it has not earned through the daily review; lowering
 * it below the current value takes effect immediately, which is the direction that protects a chip.
 */
@Injectable()
export class UpdateQuotaBandUseCase implements UseCase<UpdateQuotaBandCommand, ChannelDto> {
  private readonly logger = new Logger(UpdateQuotaBandUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: UpdateQuotaBandCommand): Promise<ChannelDto> {
    const channel = await this.channels.findById(ChannelId.from(command.channelId));
    if (!channel) {
      throw new ChannelNotFoundException();
    }

    const previous = {
      floor: channel.quota.floor,
      ceiling: channel.quota.ceiling,
      current: channel.quota.current,
    };

    channel.changeQuotaBand(command.quotaFloor, command.quotaCeiling);
    const saved = await this.channels.save(channel);

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CHANNEL_QUOTA_BAND_CHANGED,
      entityType: 'channel',
      entityId: saved.id.value,
      ip: command.ip,
      payload: {
        from: previous,
        to: {
          floor: saved.quota.floor,
          ceiling: saved.quota.ceiling,
          current: saved.quota.current,
        },
      },
    });

    this.logger.log('Faixa de cota alterada', { channelId: saved.id.value });
    return ChannelDto.fromDomain(saved);
  }
}
