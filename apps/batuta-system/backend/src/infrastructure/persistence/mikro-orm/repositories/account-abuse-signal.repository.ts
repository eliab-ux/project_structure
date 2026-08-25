import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import {
  AccountAbuseSignalRecord,
  AccountAbuseSignalRepositoryPort,
} from '../../../../contexts/platform/application/ports/output/account-abuse-signal-repository.port';
import { AccountAbuseSignalOrmEntity } from '../entities/account-abuse-signal-orm.entity';
import { TENANT_FILTER } from '../entities/tenant-scoped-orm.entity';

/**
 * Platform-scope repository: it reads a given tenant's rows from a request that has no tenant
 * scope, so the filter is disabled and every method takes the accountId EXPLICITLY. Reachable only
 * from use cases behind PlatformAdminGuard — the explicit argument is what makes each call site
 * auditable at a glance.
 */
const PLATFORM_SCOPE = { filters: { [TENANT_FILTER]: false } };

@Injectable()
export class MikroOrmAccountAbuseSignalRepository implements AccountAbuseSignalRepositoryPort {
  constructor(private readonly em: EntityManager) {}

  async upsertForDate(record: AccountAbuseSignalRecord): Promise<void> {
    await this.em.upsert(
      AccountAbuseSignalOrmEntity,
      {
        id: randomUUID(),
        accountId: record.accountId,
        date: record.date,
        sentCount: record.sentCount,
        failedCount: record.failedCount,
        deliveredCount: record.deliveredCount,
        optOutCount: record.optOutCount,
        inboundCount: record.inboundCount,
        previousDaySentCount: record.previousDaySentCount,
        createdAt: new Date(),
      },
      // Idempotent per (account, date): re-running the daily job updates rather than duplicating.
      { onConflictFields: ['accountId', 'date'], onConflictExcludeFields: ['id', 'createdAt'] },
    );
    await this.em.flush();
  }

  async findForAccountBetween(
    accountId: string,
    from: string,
    to: string,
  ): Promise<AccountAbuseSignalRecord[]> {
    const rows = await this.em.find(
      AccountAbuseSignalOrmEntity,
      { accountId, date: { $gte: from, $lte: to } },
      { ...PLATFORM_SCOPE, orderBy: { date: 'ASC' } },
    );

    return rows.map((row) => ({
      accountId: row.accountId,
      date: row.date,
      sentCount: row.sentCount,
      failedCount: row.failedCount,
      deliveredCount: row.deliveredCount,
      optOutCount: row.optOutCount,
      inboundCount: row.inboundCount,
      previousDaySentCount: row.previousDaySentCount,
    }));
  }
}
