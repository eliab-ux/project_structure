import { Injectable } from '@nestjs/common';
import {
  ChannelInboundFacts,
  WebhookDiagnosisSourcePort,
} from '../../../../contexts/channel/application/ports/output/webhook-diagnosis-source.port';
import { ScopedRawQueryService } from '../scoped-raw-query.service';

/**
 * The inbound facts of one channel, in a single round trip.
 *
 * Four scalar subqueries rather than four calls: the diagnosis is a button an operator clicks while
 * waiting, and this is the difference between one query and four. Through ScopedRawQueryService, the
 * only authorised path for raw SQL — it injects `:accountId` from the request scope and refuses SQL
 * that does not reference it, so this cannot read another tenant's channel even if the id were wrong.
 */
@Injectable()
export class MikroOrmWebhookDiagnosisSource implements WebhookDiagnosisSourcePort {
  constructor(private readonly raw: ScopedRawQueryService) {}

  async inboundFacts(channelId: string): Promise<ChannelInboundFacts> {
    const rows = await this.raw.scoped<{
      inbound_count: string;
      last_inbound_at: Date | string | null;
      contacts_total: string;
      contacts_without_ninth: string;
    }>(
      `select
         (select count(*) from messages
           where account_id = :accountId and channel_id = :channelId
             and direction = 'INBOUND') as inbound_count,
         (select max(occurred_at) from messages
           where account_id = :accountId and channel_id = :channelId
             and direction = 'INBOUND') as last_inbound_at,
         (select count(*) from contacts
           where account_id = :accountId and current_channel_id = :channelId) as contacts_total,
         -- 12 digits = 55 + DDD + 8 subscriber, i.e. the ninth digit is missing. See the port doc for
         -- why this is counted and never corrected here.
         (select count(*) from contacts
           where account_id = :accountId and current_channel_id = :channelId
             and length(regexp_replace(phone_e164, '[^0-9]', '', 'g')) = 12)
           as contacts_without_ninth`,
      { channelId },
    );

    const row = rows[0];
    return {
      inboundCount: Number(row?.inbound_count ?? 0),
      lastInboundAt: row?.last_inbound_at ? new Date(row.last_inbound_at) : null,
      contactsTotal: Number(row?.contacts_total ?? 0),
      contactsWithoutNinthDigit: Number(row?.contacts_without_ninth ?? 0),
    };
  }
}
