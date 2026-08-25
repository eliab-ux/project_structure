/**
 * Outcome of one daily throttle review (BATUTA_SPEC §2.1). Persisted together with a textual
 * reason in `channel_quality_snapshots`, because "a decisão precisa ser auditável, não opaca":
 * an operator who sees a quota drop must be able to read why without asking anyone.
 */
export enum ThrottleDecision {
  RAISE = 'RAISE',
  HOLD = 'HOLD',
  LOWER = 'LOWER',
  PAUSE = 'PAUSE',
}
