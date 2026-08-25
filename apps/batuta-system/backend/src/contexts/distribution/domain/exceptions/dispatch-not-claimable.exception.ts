import { DomainException } from '@gitspread/domain-primitives';

/**
 * A worker tried to claim a dispatch that was not PENDING.
 *
 * In normal operation this never fires: SKIP LOCKED hands each row to one worker. It firing means the
 * claim came from somewhere that skipped the lock — a manual retry, a replayed job — and it is much
 * better to hear about that than to send the same message twice.
 */
export class DispatchNotClaimableException extends DomainException {
  constructor(status: string) {
    super(`Envio em ${status} não pode ser reivindicado por um worker.`);
  }
}
