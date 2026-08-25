import { Injectable } from '@nestjs/common';
import { Channel } from '../../../../contexts/channel/domain/entities/channel.entity';
import { ChannelId } from '../../../../contexts/channel/domain/value-objects/channel-id.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import { QuotaBand } from '../../../../contexts/channel/domain/value-objects/quota-band.vo';
import { ChannelOrmEntity } from '../entities/channel-orm.entity';

@Injectable()
export class ChannelMapper {
  toDomain(orm: ChannelOrmEntity): Channel {
    return Channel.reconstitute({
      id: ChannelId.from(orm.id),
      accountId: orm.accountId,
      label: orm.label,
      phone: PhoneE164.create(orm.phoneE164),
      evolutionInstanceName: orm.evolutionInstanceName,
      status: orm.status,
      warmupStartedAt: orm.warmupStartedAt,
      quota: QuotaBand.create(orm.quotaFloor, orm.quotaCeiling, orm.currentQuota),
      consecutiveFailures: orm.consecutiveFailures,
      lastSendAt: orm.lastSendAt,
      lastQuotaReviewAt: orm.lastQuotaReviewAt,
      disconnectEventsToday: orm.disconnectEventsToday,
      lastDisconnectAt: orm.lastDisconnectAt,
      retiredAt: orm.retiredAt,
      retiredBy: orm.retiredBy,
      terminalReason: orm.terminalReason,
      createdAt: orm.createdAt,
    });
  }

  toOrmData(channel: Channel): Record<string, unknown> {
    return {
      id: channel.id.value,
      accountId: channel.accountId,
      label: channel.label,
      phoneE164: channel.phone.value,
      evolutionInstanceName: channel.evolutionInstanceName,
      status: channel.status,
      warmupStartedAt: channel.warmupStartedAt,
      currentQuota: channel.quota.current,
      quotaFloor: channel.quota.floor,
      quotaCeiling: channel.quota.ceiling,
      consecutiveFailures: channel.consecutiveFailures,
      lastSendAt: channel.lastSendAt,
      lastQuotaReviewAt: channel.lastQuotaReviewAt,
      disconnectEventsToday: channel.disconnectEventsToday,
      lastDisconnectAt: channel.lastDisconnectAt,
      retiredAt: channel.retiredAt,
      retiredBy: channel.retiredBy,
      terminalReason: channel.terminalReason,
      createdAt: channel.createdAt,
    };
  }
}
