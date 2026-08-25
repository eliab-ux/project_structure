import { AbuseSignalsDto } from '../../../../../contexts/platform/application/use-cases/get-abuse-signals/get-abuse-signals.use-case';

class AbuseSignalDayResponseDto {
  date!: string;
  sentCount!: number;
  failedCount!: number;
  deliveredCount!: number;
  optOutCount!: number;
  inboundCount!: number;
  /** Null = no sends that day, so the rate is unknown rather than zero. */
  failureRate!: number | null;
  deliveryRate!: number | null;
  optOutRate!: number | null;
  inboundRate!: number | null;
  volumeJump!: number | null;
}

/**
 * Raw counters and derived rates, with no verdict attached — what counts as abuse is
 * DECISÃO PENDENTE (§14, item 10) and a human reads these numbers.
 */
export class AbuseSignalsResponseDto {
  accountId!: string;
  from!: string;
  to!: string;
  days!: AbuseSignalDayResponseDto[];
  totals!: { sent: number; failed: number; delivered: number; optOut: number; inbound: number };

  static from(signals: AbuseSignalsDto): AbuseSignalsResponseDto {
    const dto = new AbuseSignalsResponseDto();
    dto.accountId = signals.accountId;
    dto.from = signals.from;
    dto.to = signals.to;
    dto.days = signals.days.map((day) => ({ ...day }));
    dto.totals = signals.totals;
    return dto;
  }
}
