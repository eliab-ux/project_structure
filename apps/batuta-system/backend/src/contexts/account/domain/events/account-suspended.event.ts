import { DomainEvent } from '@gitspread/domain-primitives';

/**
 * Emitted when the platform suspends a tenant. The handler that moves `RUNNING` distributions
 * to `PAUSED` lives in the distribution context (FASE 6) and subscribes to this event — the
 * account context must not know about distributions.
 */
export class AccountSuspendedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly reason: string,
    /** Platform admin id — never a tenant user. */
    public readonly suspendedBy: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'account.suspended';
  }
}
