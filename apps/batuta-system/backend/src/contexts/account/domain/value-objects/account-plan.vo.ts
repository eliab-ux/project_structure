/**
 * Commercial plan of a tenant.
 *
 * DECISÃO PENDENTE (BATUTA_SPEC §14, item 8): the commercial plan catalogue and the ceiling per
 * plan are not defined yet. The plan is therefore a plain label — it does NOT derive any limit.
 * The only enforced ceiling is `accounts.daily_send_ceiling`, set explicitly per account, so no
 * invented number leaks into behaviour. When the catalogue exists, map plan → default ceiling in
 * one place (a plan policy) and keep the per-account override.
 */
export enum AccountPlan {
  TRIAL = 'TRIAL',
  STANDARD = 'STANDARD',
  CUSTOM = 'CUSTOM',
}
