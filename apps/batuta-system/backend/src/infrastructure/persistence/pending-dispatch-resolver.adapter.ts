import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { PendingDispatchResolverPort } from '../../contexts/audience/application/ports/output/contact-import.ports';
import {
  BlockedReason,
  DispatchStatus,
} from '../../contexts/distribution/domain/value-objects/dispatch-status.vo';
import { DispatchOrmEntity } from './mikro-orm/entities/dispatch-orm.entity';

/**
 * Closes the seam FASE 3 left open (§6.4 item 5).
 *
 * The obligation, in the spec's words: "Dispatches pendentes do canal morto: resolver explicitamente —
 * reatribuir ao novo remetente ou CANCELLED com motivo. Nunca deixe dispatch órfão apontando para canal
 * terminal." FASE 3 shipped the port with a no-op because `dispatches` did not exist; now it does. The
 * migration use case has been calling the port unconditionally all along, which is the point of a seam.
 *
 * Two outcomes, in order:
 *
 *  1. **contacts that got a new sender** → their pending dispatches follow them. The message was
 *     approved for that person and the text does not change; only the chip does.
 *  2. **whatever is left** → BLOCKED with `SENDER_UNAVAILABLE`, not CANCELLED. Both stop the send, and
 *     the distinction is for whoever reads it later: cancelled means a human called it off, blocked
 *     means the system could not do it and says why. Writing "cancelled" here would put words in the
 *     operator's mouth.
 *
 * **Why it talks to the EntityManager instead of the dispatch repository.** Injecting
 * `DISPATCH_REPOSITORY` would make AudienceModule import DistributionModule, and DistributionModule
 * already imports AudienceModule (it needs the audience to expand a filter) and ContentModule, which
 * imports AudienceModule too — a three-module cycle that `forwardRef` can only paper over. Reading the
 * ORM entity directly here is the same choice already made for `MikroOrmDailySendUsage`, and tenant
 * isolation is unaffected: `dispatches` inherits the default-on tenant filter like every other table.
 *
 * A re-pointed dispatch keeps its `scheduled_at`. The new chip may have a different quota, and the
 * worker re-validates that at send time (§10 item 2) — which is where that check belongs, rather than
 * re-planning a whole campaign inside a migration.
 */
@Injectable()
export class DispatchPendingResolver implements PendingDispatchResolverPort {
  private readonly logger = new Logger(DispatchPendingResolver.name);

  constructor(private readonly em: EntityManager) {}

  async resolveForMigration(input: {
    accountId: string;
    fromChannelId: string;
    migrationId: string;
    reassignments: ReadonlyMap<string, string>;
  }): Promise<number> {
    // Grouped by destination so it is one UPDATE per target channel, not one per contact.
    const byTarget = new Map<string, string[]>();
    for (const [contactId, channelId] of input.reassignments) {
      const list = byTarget.get(channelId) ?? [];
      list.push(contactId);
      byTarget.set(channelId, list);
    }

    let reassigned = 0;
    for (const [channelId, contactIds] of byTarget) {
      reassigned += await this.em.nativeUpdate(
        DispatchOrmEntity,
        {
          channelId: input.fromChannelId,
          status: DispatchStatus.PENDING,
          contactId: { $in: contactIds },
        },
        { channelId },
      );
    }

    // Anything still pointing at the dead channel had no destination — its contact was not part of the
    // migration, or the strategy left it unassigned.
    const blocked = await this.em.nativeUpdate(
      DispatchOrmEntity,
      { channelId: input.fromChannelId, status: DispatchStatus.PENDING },
      { status: DispatchStatus.BLOCKED, blockedReason: BlockedReason.SENDER_UNAVAILABLE },
    );

    if (reassigned > 0 || blocked > 0) {
      this.logger.warn('Dispatches pendentes do canal migrado resolvidos', {
        migrationId: input.migrationId,
        reassigned,
        blocked,
      });
    }

    return reassigned + blocked;
  }
}
