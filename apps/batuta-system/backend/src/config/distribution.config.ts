import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isValidTimeZone } from '../shared/domain/services/zoned-time';

/**
 * The scheduling numbers, in one place (§9.2).
 *
 * ⚠️ DECISÕES PENDENTES (§14). Provisional values, all of them the suggestion §14 itself offers, so
 * they are easy to confirm or overrule:
 *
 *  - item 4 — share of the quota reserved for inbox replies: **20%**.
 *  - item 5 — interval between sends of the same channel: **45–120s aleatório**.
 *  - item 6 — quiet hours: **08:00–21:00 no timezone da conta**.
 *
 * `maxPerHourPerChannel` is NOT in §14 — it comes from §9.2 ("máximo por hora") with no number
 * attached, so 30 is mine. Reasoning: with a 150/day ceiling spread over 13 admissible hours the
 * natural rate is about 12/hour, so 30 only binds when a large quota meets a short window — which is
 * exactly the burst this limit exists to prevent. It is an engineering guard, not a product rule.
 *
 * Measure on the first real campaign and recalibrate (§15, risco 4).
 */
@Injectable()
export class DistributionConfig {
  constructor(private readonly config: ConfigService) {}

  /** §14 item 4 — DECISÃO PENDENTE (sugestão do spec: 20%). */
  get replyReserveRatio(): number {
    const percent = this.int('DISTRIBUTION_REPLY_RESERVE_PERCENT', 20);
    // Clamped: a reserve of 0 would let a campaign consume the whole chip and starve the inbox, and
    // anything above 80% would make campaigns pointless. Both are configuration mistakes, not intents.
    return Math.min(Math.max(percent, 5), 80) / 100;
  }

  /** §14 item 5 — DECISÃO PENDENTE (sugestão do spec: 45–120s). */
  get minIntervalSeconds(): number {
    return this.int('DISPATCH_MIN_INTERVAL_SECONDS', 45);
  }

  get maxIntervalSeconds(): number {
    const max = this.int('DISPATCH_MAX_INTERVAL_SECONDS', 120);
    // A max below the min would silently disable the jitter, which is the one thing here that must
    // not be disabled by a typo (§9.2).
    return Math.max(max, this.minIntervalSeconds);
  }

  /** Not in §14: engineering guard against bursts. See the class docblock. */
  get maxPerHourPerChannel(): number {
    return this.int('DISPATCH_MAX_PER_HOUR', 30);
  }

  /** §14 item 6 — DECISÃO PENDENTE (sugestão do spec: 08:00–21:00). */
  get quietHoursStart(): number {
    return this.hour('QUIET_HOURS_START', 8);
  }

  get quietHoursEnd(): number {
    const end = this.hour('QUIET_HOURS_END', 21);
    return end > this.quietHoursStart ? end : 21;
  }

  /**
   * Fallback timezone when an account has none.
   *
   * Falls back rather than throwing because a missing timezone must not block a send; and it is
   * validated because an invalid IANA name would make `Intl` throw deep inside the scheduler, far
   * from the cause.
   */
  get defaultTimeZone(): string {
    const zone = this.config.get<string>('DEFAULT_TIMEZONE') ?? 'America/Sao_Paulo';
    return isValidTimeZone(zone) ? zone : 'America/Sao_Paulo';
  }

  private int(key: string, fallback: number): number {
    const parsed = Number.parseInt(String(this.config.get(key) ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private hour(key: string, fallback: number): number {
    const parsed = Number.parseInt(String(this.config.get(key) ?? ''), 10);
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : fallback;
  }
}
