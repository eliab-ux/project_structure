import { DomainEvent } from '@gitspread/domain-primitives';

/**
 * The operator confirmed the plan. This is the handoff from planning (FASE 6) to execution (FASE 7).
 *
 * An event and not a direct call because the enqueue is the dispatch context's job, and the
 * distribution aggregate must not know that BullMQ exists.
 */
export class DistributionConfirmedEvent extends DomainEvent {
  constructor(
    public readonly accountId: string,
    public readonly distributionId: string,
    public readonly contentId: string,
  ) {
    super();
  }

  get eventName(): string {
    return 'distribution.confirmed';
  }
}
