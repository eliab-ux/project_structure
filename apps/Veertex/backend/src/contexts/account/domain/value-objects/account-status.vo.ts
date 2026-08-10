/**
 * Lifecycle of a tenant (01_Veertex_Core §3.1).
 *
 * `CANCELLED` is the end state and is reached only after `cancellation_requested_at` gave the
 * customer the window to export their data — "nunca prender dados do cliente" (Visão Geral §2.5)
 * is a sequence, not a single flag, which is why the request timestamp is a separate field.
 */
export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}
