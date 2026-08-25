import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../../account/domain/exceptions/account-not-found.exception';
import {
  ACCOUNT_ABUSE_SIGNAL_REPOSITORY,
  AccountAbuseSignalRepositoryPort,
} from '../../ports/output/account-abuse-signal-repository.port';
import { GetAbuseSignalsQuery } from './get-abuse-signals.query';

/** Per-day counters plus the rates derived from them. */
export class AbuseSignalDayDto {
  date!: string;
  sentCount!: number;
  failedCount!: number;
  deliveredCount!: number;
  optOutCount!: number;
  inboundCount!: number;
  /** Null when there were no sends that day — a rate over zero is not "0%", it is unknown. */
  failureRate!: number | null;
  deliveryRate!: number | null;
  optOutRate!: number | null;
  inboundRate!: number | null;
  /** Multiplier over the previous day's volume. Null when yesterday had no sends. */
  volumeJump!: number | null;
}

export class AbuseSignalsDto {
  accountId!: string;
  from!: string;
  to!: string;
  days!: AbuseSignalDayDto[];
  totals!: { sent: number; failed: number; delivered: number; optOut: number; inbound: number };
  /**
   * No verdict field on purpose. Deciding what rate counts as abuse is DECISÃO PENDENTE
   * (§14, item 10); until it is decided, the platform screen shows numbers and a human judges.
   */
}

@Injectable()
export class GetAbuseSignalsUseCase implements UseCase<GetAbuseSignalsQuery, AbuseSignalsDto> {
  constructor(
    @Inject(ACCOUNT_ABUSE_SIGNAL_REPOSITORY)
    private readonly signals: AccountAbuseSignalRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
  ) {}

  async execute(query: GetAbuseSignalsQuery): Promise<AbuseSignalsDto> {
    const account = await this.accounts.findById(AccountId.from(query.accountId));
    if (!account) {
      throw new AccountNotFoundException();
    }

    const rows = await this.signals.findForAccountBetween(query.accountId, query.from, query.to);

    const dto = new AbuseSignalsDto();
    dto.accountId = query.accountId;
    dto.from = query.from;
    dto.to = query.to;
    dto.days = rows.map((row) => {
      const day = new AbuseSignalDayDto();
      day.date = row.date;
      day.sentCount = row.sentCount;
      day.failedCount = row.failedCount;
      day.deliveredCount = row.deliveredCount;
      day.optOutCount = row.optOutCount;
      day.inboundCount = row.inboundCount;
      day.failureRate = rate(row.failedCount, row.sentCount);
      day.deliveryRate = rate(row.deliveredCount, row.sentCount);
      day.optOutRate = rate(row.optOutCount, row.sentCount);
      day.inboundRate = rate(row.inboundCount, row.sentCount);
      day.volumeJump =
        row.previousDaySentCount > 0
          ? Number((row.sentCount / row.previousDaySentCount).toFixed(2))
          : null;
      return day;
    });
    dto.totals = rows.reduce(
      (acc, row) => ({
        sent: acc.sent + row.sentCount,
        failed: acc.failed + row.failedCount,
        delivered: acc.delivered + row.deliveredCount,
        optOut: acc.optOut + row.optOutCount,
        inbound: acc.inbound + row.inboundCount,
      }),
      { sent: 0, failed: 0, delivered: 0, optOut: 0, inbound: 0 },
    );
    return dto;
  }
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }
  return Number((numerator / denominator).toFixed(4));
}
