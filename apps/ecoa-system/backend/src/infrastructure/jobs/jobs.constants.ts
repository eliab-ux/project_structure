/** BullMQ queue names. Each queue holds per-tenant child jobs fanned out by the scheduler. */
export const QUEUE_REFRESH_TOKEN = 'ig-refresh-token';
export const QUEUE_SYNC_MEDIA = 'ig-sync-media';
export const QUEUE_CAPTURE_INSIGHTS = 'ig-capture-insights';
export const QUEUE_RESOLVE_WATCHLIST = 'ig-resolve-watchlist';
export const QUEUE_RECONCILE_MENTIONS = 'ig-reconcile-mentions';

export const ALL_QUEUES = [
  QUEUE_REFRESH_TOKEN,
  QUEUE_SYNC_MEDIA,
  QUEUE_CAPTURE_INSIGHTS,
  QUEUE_RESOLVE_WATCHLIST,
  QUEUE_RECONCILE_MENTIONS,
];

/** Payload every per-tenant child job carries. Never a token — the processor resolves it. */
export interface TenantJobData {
  ownerId: string;
  igUserId: string;
}
