import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { DailySendUsagePort } from '../../contexts/account/application/ports/output/daily-send-usage.port';
import { ChannelDailyCounterOrmEntity } from './mikro-orm/entities/channel-daily-counter-orm.entity';

/**
 * How much the account has already sent today, summed across all of its channels.
 *
 * This is the FASE 2 implementation of the port that FASE 1 stubbed with zero: `channel_daily_counters`
 * exists now, and it is the source of truth for quota (§4) — Redis is a cache, never the truth.
 *
 * It reads the table through the EntityManager rather than through the channel context's repository
 * port, on purpose: the port belongs to the ACCOUNT context (the ceiling is an account rule), and
 * routing it through ChannelModule would make the account module depend on the channel module for a
 * single SUM. Two adapters in the same persistence layer sharing a table is ordinary infrastructure;
 * two contexts depending on each other's modules is not.
 *
 * Isolation still holds mechanically: `channel_daily_counters` extends TenantScopedOrmEntity, so the
 * default-on tenant filter scopes this query exactly like any other.
 *
 * Campaign and reply sends are summed here because the ACCOUNT ceiling is about total volume; the
 * separation between them matters for scheduling (§9.2), not for the ceiling.
 */
@Injectable()
export class MikroOrmDailySendUsage implements DailySendUsagePort {
  private readonly logger = new Logger(MikroOrmDailySendUsage.name);

  constructor(private readonly em: EntityManager) {}

  async totalSentToday(accountId: string, timezone: string): Promise<number> {
    const today = MikroOrmDailySendUsage.todayIn(timezone);

    const rows = await this.em.find(ChannelDailyCounterOrmEntity, { date: today });
    const total = rows.reduce((sum, row) => sum + row.campaignSends + row.replySends, 0);

    this.logger.debug('Uso diário consultado', { accountId, date: today, total });
    return total;
  }

  /**
   * Calendar day in an IANA timezone, as YYYY-MM-DD — a tenant in Manaus must not have its quota
   * roll over on São Paulo's clock, nor on UTC's.
   *
   * `en-CA` because its short date format is already ISO: no manual assembling of parts, no
   * month/day inversion bug.
   */
  static todayIn(timezone: string): string {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      // An invalid timezone must not stop a send: fall back to UTC and let the account's
      // configuration be fixed separately.
      return new Date().toISOString().slice(0, 10);
    }
  }
}
