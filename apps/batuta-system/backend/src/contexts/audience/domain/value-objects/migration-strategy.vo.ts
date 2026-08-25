/** How a dead channel contacts are re-homed (§6.4 item 2). */
export enum MigrationStrategy {
  /** Everyone to one chosen channel. Simple, but unbalances — the preview must show the result. */
  ALL_TO_ONE = 'ALL_TO_ONE',
  /** Spread across the remaining channels by the greedy rule of §6.2. Suggested default in the UI. */
  REDISTRIBUTE = 'REDISTRIBUTE',
}

export enum MigrationStatus {
  /** Previewed and recorded, not yet applied. */
  PLANNED = 'PLANNED',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED',
}
