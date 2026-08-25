import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { ThrottleConfig } from '../../../../../config/throttle.config';
import {
  WHATSAPP_GATEWAY,
  WhatsAppGatewayPort,
} from '../../../../../infrastructure/whatsapp/ports/whatsapp-gateway.port';
import { Channel } from '../../../domain/entities/channel.entity';
import { PhoneE164 } from '../../../../../shared/domain/value-objects/phone-e164.vo';
import { QuotaBand } from '../../../domain/value-objects/quota-band.vo';
import { ChannelAlreadyExistsException } from '../../../domain/exceptions/channel-already-exists.exception';
import { ChannelDto } from '../../dto/channel.dto';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../ports/output/channel-repository.port';
import { CreateChannelCommand } from './create-channel.command';

/**
 * Provisions a chip: creates the row, creates the Evolution instance, and leaves the channel in
 * AWAITING_QR so the operator can scan (§5, FASE 2 item 3).
 *
 * Order matters. The row is persisted as PROVISIONING FIRST, then the instance is created remotely.
 * If it were the other way round, a crash between the two would leave an orphan instance on the
 * Evolution server that nothing in our database knows about — and on a shared server that is
 * someone else's problem to clean up. This way the worst case is a channel stuck in PROVISIONING,
 * which the operator can retry or delete.
 */
@Injectable()
export class CreateChannelUseCase implements UseCase<CreateChannelCommand, ChannelDto> {
  private readonly logger = new Logger(CreateChannelUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(WHATSAPP_GATEWAY) private readonly gateway: WhatsAppGatewayPort,
    private readonly throttleConfig: ThrottleConfig,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: CreateChannelCommand): Promise<ChannelDto> {
    const phone = PhoneE164.create(command.phone);

    // Tenant-scoped: the same number may exist as a channel of another account.
    const existing = await this.channels.findByPhone(phone);
    if (existing) {
      throw new ChannelAlreadyExistsException();
    }

    const defaults = this.throttleConfig.defaultQuotaBand;
    const quota = QuotaBand.create(
      command.quotaFloor ?? defaults.floor,
      command.quotaCeiling ?? defaults.ceiling,
    );

    const channel = Channel.create({
      accountId: command.accountId,
      label: command.label,
      phone,
      quota,
    });

    const saved = await this.channels.save(channel);

    const instance = {
      instanceName: saved.evolutionInstanceName,
      accountId: command.accountId,
    };

    try {
      await this.gateway.createInstance(instance);
      saved.markAwaitingQr();
      await this.channels.save(saved);
    } catch (error) {
      // The channel stays in PROVISIONING and the operator retries. We do not delete the row:
      // losing it would hide the fact that an instance may already exist under this name.
      this.logger.error('Falha ao criar instância na Evolution', {
        channelId: saved.id.value,
        error: (error as Error)?.message,
      });
      throw error;
    }

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.CHANNEL_CREATED,
      entityType: 'channel',
      entityId: saved.id.value,
      ip: command.ip,
      // Masked phone only — the audit payload never carries a full number.
      payload: {
        label: saved.label,
        phone: saved.phone.masked,
        quotaFloor: quota.floor,
        quotaCeiling: quota.ceiling,
      },
    });

    this.logger.log('Canal provisionado', {
      channelId: saved.id.value,
      accountId: command.accountId,
    });
    return ChannelDto.fromDomain(saved);
  }
}
