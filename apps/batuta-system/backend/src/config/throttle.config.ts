import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottleThresholds } from '../contexts/channel/domain/services/throttle-policy';

/**
 * The one place where throttle numbers exist. Nothing is hardcoded in the policy or in the job
 * (§2.1, last rule) — change these envs and the behaviour changes without touching code.
 *
 * ⚠️ DECISÃO PENDENTE (§14, itens 1, 2 e 3). Provisional values, to be confirmed:
 *
 *  - item 1 — `quota_floor` / `quota_ceiling` default: 20/dia and 150/dia, as suggested by §14.
 *  - item 3 — factors and window: +20% / −50%, 3-day window, as suggested by §14.
 *  - item 2 — thresholds: §14 offers NO suggestion, so the values below are mine, chosen
 *    conservatively and argued here so they are easy to challenge:
 *      · `severeFailureRate` 20% — a fifth of sends erroring is an instance/API fault, not
 *        audience behaviour; PAUSE rather than nurse it down.
 *      · `lowDeliveryRate` 85% — delivery is the main proxy for blocks. Healthy 1:1 traffic to a
 *        live base sits well above this; 85% means roughly one in seven recipients is not
 *        receiving, which is the shape of a number being blocked.
 *      · `highOptOutRate` 2% — one in fifty explicitly asking to leave is already a bad list, and
 *        opt-out is the most honest rejection signal there is.
 *      · `severeDisconnectEvents` 3 in the window — one drop is a phone, three is an instance.
 *      · `minSampleForDecision` 20 sends — see the port docs; below it, rates are noise.
 *
 * Measure on the first real campaign and recalibrate (§15, risco 4): these are engineering
 * ceilings, not WhatsApp limits.
 */
@Injectable()
export class ThrottleConfig {
  constructor(private readonly config: ConfigService) {}

  get thresholds(): ThrottleThresholds {
    return {
      evaluationWindowDays: this.int('THROTTLE_WINDOW_DAYS', 3),
      cleanDaysForRaise: this.int('THROTTLE_CLEAN_DAYS_FOR_RAISE', 3),
      severeFailureRate: this.rate('THROTTLE_SEVERE_FAILURE_RATE', 0.2),
      severeDisconnectEvents: this.int('THROTTLE_SEVERE_DISCONNECT_EVENTS', 3),
      lowDeliveryRate: this.rate('THROTTLE_LOW_DELIVERY_RATE', 0.85),
      highOptOutRate: this.rate('THROTTLE_HIGH_OPT_OUT_RATE', 0.02),
      raiseFactor: this.rate('THROTTLE_RAISE_FACTOR', 1.2, 5),
      lowerFactor: this.rate('THROTTLE_LOWER_FACTOR', 0.5),
      minSampleForDecision: this.int('THROTTLE_MIN_SAMPLE', 20),
    };
  }

  get factors(): { raise: number; lower: number } {
    const { raiseFactor, lowerFactor } = this.thresholds;
    return { raise: raiseFactor, lower: lowerFactor };
  }

  /** Default band for a channel created without explicit numbers (§14, item 1). */
  get defaultQuotaBand(): { floor: number; ceiling: number } {
    return {
      floor: this.int('CHANNEL_DEFAULT_QUOTA_FLOOR', 20),
      ceiling: this.int('CHANNEL_DEFAULT_QUOTA_CEILING', 150),
    };
  }

  /** Consecutive send failures that trip the circuit breaker (§10, FASE 7 item 7). */
  get circuitBreakerFailureThreshold(): number {
    return this.int('CHANNEL_CIRCUIT_BREAKER_FAILURES', 5);
  }

  private int(key: string, fallback: number): number {
    const raw = this.config.get<number | string>(key);
    const parsed = Number.parseInt(String(raw ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private rate(key: string, fallback: number, max = 1): number {
    const raw = this.config.get<number | string>(key);
    const parsed = Number.parseFloat(String(raw ?? ''));
    return Number.isFinite(parsed) && parsed > 0 && parsed <= max ? parsed : fallback;
  }
}
