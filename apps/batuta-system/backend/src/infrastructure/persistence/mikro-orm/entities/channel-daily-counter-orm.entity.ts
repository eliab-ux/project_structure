import { Entity, Index, Property, Unique } from '@mikro-orm/core';
import { TenantScopedOrmEntity } from './tenant-scoped-orm.entity';

/**
 * Source of truth for quota consumption (§4). Redis is a cache, never the truth.
 *
 * Campaign and reply sends are counted SEPARATELY because they behave differently in scheduling —
 * replies get their own reserved slice and jump the queue (§9.2, §10.4) — but they are SUMMED for
 * risk, since WhatsApp does not care why a message was sent.
 */
@Entity({ tableName: 'channel_daily_counters' })
@Unique({ properties: ['channelId', 'date'] })
@Index({ properties: ['accountId', 'date'] })
export class ChannelDailyCounterOrmEntity extends TenantScopedOrmEntity {
  @Property({ type: 'uuid', fieldName: 'channel_id' })
  channelId!: string;

  /** Calendar day in the ACCOUNT's timezone — the tenant's own day, not UTC's. */
  @Property({ type: 'date' })
  date!: string;

  @Property({ type: 'int', fieldName: 'campaign_sends' })
  campaignSends: number = 0;

  @Property({ type: 'int', fieldName: 'reply_sends' })
  replySends: number = 0;
}
