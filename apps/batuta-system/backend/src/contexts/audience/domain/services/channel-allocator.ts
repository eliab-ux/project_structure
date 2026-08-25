/** A candidate channel and how many contacts it already carries. */
export interface ChannelLoad {
  channelId: string;
  /** Contacts currently allocated to this channel. */
  allocatedContacts: number;
  /** Tie-break: older channels win, so the outcome never depends on row order. */
  createdAt: Date;
}

export interface Allocation {
  channelId: string;
}

/**
 * The single allocation rule (§6.2):
 *
 *   canais CONNECTED, ordenados por (contatos_alocados ASC, created_at ASC, id ASC) → primeiro
 *
 * Greedy by least load, deterministic tie-break. **Nada além disso.**
 *
 * The elegance the spec points out: this one rule already handles both cases, with no "catch-up
 * mode", no parity maths and no flag.
 *  - Normal operation: it spreads evenly.
 *  - A new channel with 0 contacts among channels with 100: being the least loaded, it takes EVERY
 *    new contact until it draws level, then the even split resumes.
 *
 * Pure and free of infrastructure: it receives the loads and returns the picks, which is what makes
 * the two cases above testable without a database.
 */
export class ChannelAllocator {
  private readonly loads: ChannelLoad[];

  constructor(eligibleChannels: readonly ChannelLoad[]) {
    // Copy: allocating a batch mutates the running loads, and the caller's array must not change.
    this.loads = eligibleChannels.map((load) => ({ ...load }));
  }

  get hasEligibleChannel(): boolean {
    return this.loads.length > 0;
  }

  /**
   * Picks the sender for ONE contact and books the load, so the next call sees the updated picture.
   * That is what makes a batch spread instead of dumping everything on the same channel.
   */
  allocateOne(): Allocation {
    if (this.loads.length === 0) {
      // The caller must check `hasEligibleChannel` and fail the import with a clear message (§6.2).
      throw new Error('Nenhum canal elegível para alocação.');
    }

    const chosen = this.loads.reduce((best, candidate) =>
      ChannelAllocator.compare(candidate, best) < 0 ? candidate : best,
    );

    chosen.allocatedContacts += 1;
    return { channelId: chosen.channelId };
  }

  /** Allocates `count` contacts, returning one pick per contact in order. */
  allocateMany(count: number): Allocation[] {
    return Array.from({ length: count }, () => this.allocateOne());
  }

  /** Current loads after everything booked so far — this is what the migration preview shows. */
  snapshot(): ChannelLoad[] {
    return this.loads.map((load) => ({ ...load }));
  }

  /** (allocated ASC, createdAt ASC, id ASC) — the third key is what removes all remaining ambiguity. */
  private static compare(a: ChannelLoad, b: ChannelLoad): number {
    if (a.allocatedContacts !== b.allocatedContacts) {
      return a.allocatedContacts - b.allocatedContacts;
    }
    const byAge = a.createdAt.getTime() - b.createdAt.getTime();
    if (byAge !== 0) {
      return byAge;
    }
    return a.channelId.localeCompare(b.channelId);
  }
}
