import { ThrottleDecision } from '../value-objects/throttle-decision.vo';

/**
 * Daily counters of ONE day for ONE channel. These are the only signals the WhatsApp side actually
 * gives us (§2.1) — do not invent others: WhatsApp never tells you that a number was blocked.
 */
export interface ChannelDaySignals {
  date: string;
  /** campaign_sends + reply_sends: both count for risk (§2.1). */
  sentCount: number;
  failedCount: number;
  deliveredCount: number;
  optOutCount: number;
  inboundCount: number;
  disconnectEvents: number;
}

/**
 * Thresholds and factors. Configuration, never hardcoded (§2.1, last rule) — the concrete values
 * live in `throttle.config.ts`, fed by env.
 */
export interface ThrottleThresholds {
  /** Days of history considered. Only days WITH sends count (§2.1: "últimos N dias com envio"). */
  evaluationWindowDays: number;
  /** Consecutive clean days required to earn a RAISE. */
  cleanDaysForRaise: number;
  /** failure_rate above this is a serious API/instance fault → PAUSE. */
  severeFailureRate: number;
  /** disconnect_events at or above this in the window → PAUSE. */
  severeDisconnectEvents: number;
  /** delivery_rate below this → LOWER. The main proxy for blocks/bans. */
  lowDeliveryRate: number;
  /** opt_out_rate above this → LOWER. */
  highOptOutRate: number;
  /** Multiplier applied on RAISE (gradual, > 1). */
  raiseFactor: number;
  /** Multiplier applied on LOWER (aggressive, < 1). */
  lowerFactor: number;
  /**
   * Minimum sends in the window before any rate is trusted.
   *
   * NOT in the spec, and necessary: with 3 sends and 1 failure the failure_rate is 33% and a
   * literal reading of the algorithm would PAUSE a perfectly healthy channel on noise. Below this
   * count the decision is HOLD with "amostra insuficiente" as the reason, which is also what a
   * brand-new channel sees on its first day.
   */
  minSampleForDecision: number;
}

/** Rates derived from the window. `null` means "unknown", which is not the same as zero. */
export interface ThrottleWindowMetrics {
  daysConsidered: number;
  sentCount: number;
  failedCount: number;
  deliveredCount: number;
  optOutCount: number;
  inboundCount: number;
  disconnectEvents: number;
  failureRate: number | null;
  deliveryRate: number | null;
  optOutRate: number | null;
  /** Reported and shown in the panel; see the note below on why it is not part of the decision. */
  inboundRate: number | null;
}

export interface ThrottleEvaluation {
  decision: ThrottleDecision;
  /** Human-readable justification, persisted with the snapshot. Never opaque (§2.1). */
  reason: string;
  metrics: ThrottleWindowMetrics;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function pct(value: number | null): string {
  return value === null ? 'n/d' : `${(value * 100).toFixed(1)}%`;
}

/**
 * The daily review, as a pure function (§2.1).
 *
 * Deliberately pure and free of infrastructure so the decision table is testable in isolation —
 * this is the piece whose mistakes cost chips.
 *
 * Order of checks matches the spec exactly: PAUSE beats LOWER beats RAISE, and HOLD is the
 * default. Asymmetry is intentional: raising is gradual, lowering is aggressive.
 *
 * One deviation worth naming: `inbound_rate` is measured, snapshotted and displayed, but it is NOT
 * an input to the decision. The spec's own pseudocode does not use it, and gating RAISE on inbound
 * would freeze every ramp until FASE 8 exists to produce inbound at all. It belongs in the panel,
 * where a human reads "this chip only talks and never listens".
 */
export function evaluateThrottle(
  history: readonly ChannelDaySignals[],
  thresholds: ThrottleThresholds,
): ThrottleEvaluation {
  const window = history
    .filter((day) => day.sentCount > 0 || day.disconnectEvents > 0)
    .slice(-thresholds.evaluationWindowDays);

  const totals = window.reduce(
    (acc, day) => ({
      sentCount: acc.sentCount + day.sentCount,
      failedCount: acc.failedCount + day.failedCount,
      deliveredCount: acc.deliveredCount + day.deliveredCount,
      optOutCount: acc.optOutCount + day.optOutCount,
      inboundCount: acc.inboundCount + day.inboundCount,
      disconnectEvents: acc.disconnectEvents + day.disconnectEvents,
    }),
    {
      sentCount: 0,
      failedCount: 0,
      deliveredCount: 0,
      optOutCount: 0,
      inboundCount: 0,
      disconnectEvents: 0,
    },
  );

  const metrics: ThrottleWindowMetrics = {
    daysConsidered: window.length,
    ...totals,
    failureRate: rate(totals.failedCount, totals.sentCount),
    deliveryRate: rate(totals.deliveredCount, totals.sentCount),
    optOutRate: rate(totals.optOutCount, totals.sentCount),
    inboundRate: rate(totals.inboundCount, totals.sentCount),
  };

  // Instability is judged on its own, before any rate: a flapping instance is a problem even on a
  // day with no sends at all.
  if (totals.disconnectEvents >= thresholds.severeDisconnectEvents) {
    return {
      decision: ThrottleDecision.PAUSE,
      reason:
        `Instabilidade de conexão: ${totals.disconnectEvents} desconexões na janela ` +
        `(limiar ${thresholds.severeDisconnectEvents}).`,
      metrics,
    };
  }

  if (totals.sentCount < thresholds.minSampleForDecision) {
    return {
      decision: ThrottleDecision.HOLD,
      reason:
        `Amostra insuficiente: ${totals.sentCount} envios na janela ` +
        `(mínimo ${thresholds.minSampleForDecision}). Mantendo a cota.`,
      metrics,
    };
  }

  if (metrics.failureRate !== null && metrics.failureRate > thresholds.severeFailureRate) {
    return {
      decision: ThrottleDecision.PAUSE,
      reason:
        `Falha grave de envio: ${pct(metrics.failureRate)} ` +
        `(limiar ${pct(thresholds.severeFailureRate)}).`,
      metrics,
    };
  }

  if (metrics.deliveryRate !== null && metrics.deliveryRate < thresholds.lowDeliveryRate) {
    return {
      decision: ThrottleDecision.LOWER,
      reason:
        `Entrega abaixo do limiar: ${pct(metrics.deliveryRate)} ` +
        `(mínimo ${pct(thresholds.lowDeliveryRate)}) — principal proxy de bloqueio.`,
      metrics,
    };
  }

  if (metrics.optOutRate !== null && metrics.optOutRate > thresholds.highOptOutRate) {
    return {
      decision: ThrottleDecision.LOWER,
      reason:
        `Opt-out acima do limiar: ${pct(metrics.optOutRate)} ` +
        `(máximo ${pct(thresholds.highOptOutRate)}).`,
      metrics,
    };
  }

  const cleanDays = countTrailingCleanDays(window, thresholds);
  if (cleanDays >= thresholds.cleanDaysForRaise) {
    return {
      decision: ThrottleDecision.RAISE,
      reason:
        `Sinais limpos por ${cleanDays} dia(s) consecutivo(s): entrega ${pct(metrics.deliveryRate)}, ` +
        `falha ${pct(metrics.failureRate)}, opt-out ${pct(metrics.optOutRate)}.`,
      metrics,
    };
  }

  return {
    decision: ThrottleDecision.HOLD,
    reason:
      `Sem sinal de risco, mas apenas ${cleanDays} de ${thresholds.cleanDaysForRaise} dia(s) ` +
      'limpos consecutivos para subir.',
    metrics,
  };
}

/** A day is clean when none of its own rates crosses a threshold. Counted from the most recent. */
function countTrailingCleanDays(
  window: readonly ChannelDaySignals[],
  thresholds: ThrottleThresholds,
): number {
  let clean = 0;
  for (let i = window.length - 1; i >= 0; i -= 1) {
    if (!isCleanDay(window[i], thresholds)) {
      break;
    }
    clean += 1;
  }
  return clean;
}

function isCleanDay(day: ChannelDaySignals, thresholds: ThrottleThresholds): boolean {
  if (day.disconnectEvents > 0) {
    return false;
  }
  if (day.sentCount === 0) {
    // No sends is not evidence of health — it just is not evidence of anything.
    return false;
  }
  const failureRate = day.failedCount / day.sentCount;
  const deliveryRate = day.deliveredCount / day.sentCount;
  const optOutRate = day.optOutCount / day.sentCount;

  return (
    failureRate <= thresholds.severeFailureRate &&
    deliveryRate >= thresholds.lowDeliveryRate &&
    optOutRate <= thresholds.highOptOutRate
  );
}
