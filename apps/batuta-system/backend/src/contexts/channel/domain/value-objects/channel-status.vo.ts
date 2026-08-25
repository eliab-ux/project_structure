/**
 * Lifecycle of a chip. The semantics here are the most consequential in the system
 * (BATUTA_SPEC §4, nota "Semântica dos estados — crítico").
 *
 *  - `DISCONNECTED` is **transient**: phone off, expired QR, network drop. It never enables
 *    contact migration, because migrating 100 contacts because someone let a battery die is
 *    irreversible in practice.
 *  - `DEGRADED` is also transient: the system paused this channel on purpose (throttle PAUSE or
 *    circuit breaker) and wants a human to look.
 *  - `BANNED` and `RETIRED` are **terminal** and reachable ONLY by explicit human declaration.
 *    No automatic routine — not the webhook, not the throttle job, not the circuit breaker —
 *    ever promotes a channel to a terminal state.
 */
export enum ChannelStatus {
  PROVISIONING = 'PROVISIONING',
  AWAITING_QR = 'AWAITING_QR',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  DEGRADED = 'DEGRADED',
  BANNED = 'BANNED',
  RETIRED = 'RETIRED',
}

/** Terminal states: no transition leaves them, and only a human puts a channel here. */
export const TERMINAL_STATUSES: readonly ChannelStatus[] = [
  ChannelStatus.BANNED,
  ChannelStatus.RETIRED,
];

export function isTerminal(status: ChannelStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Only a CONNECTED channel sends. Everything else makes a dispatch BLOCKED, never rerouted. */
export function canSend(status: ChannelStatus): boolean {
  return status === ChannelStatus.CONNECTED;
}

/**
 * Only a terminal state enables sender migration (§6.4). `DISCONNECTED` deliberately does not:
 * this single function is what the migration use case will consult in FASE 3.
 */
export function allowsSenderMigration(status: ChannelStatus): boolean {
  return isTerminal(status);
}

/** A channel eligible to receive newly imported contacts (§6.2). */
export function acceptsNewContacts(status: ChannelStatus): boolean {
  return status === ChannelStatus.CONNECTED;
}
