import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { ConversationMigratorPort } from '../../contexts/audience/application/ports/output/contact-import.ports';
import { ConversationStatus } from '../../contexts/inbox/domain/value-objects/conversation-status.vo';
import { ConversationOrmEntity } from './mikro-orm/entities/conversation-orm.entity';

/**
 * Closes the second seam FASE 3 left open (§6.4 item 6).
 *
 * The requirement: open conversations of a dead channel move with their contacts, while `messages` keeps
 * the original `channel_id` of each message. Both halves matter and they pull in opposite directions —
 * the conversation is a live workspace and has to point at the chip that will actually send the next
 * reply; the messages are history and must keep saying which number carried each one.
 *
 * So this method touches `conversations` only. There is deliberately no UPDATE on `messages` here, and
 * that absence is the requirement rather than an omission.
 *
 * Only OPEN conversations move. A resolved thread from three months ago belongs to the chip that handled
 * it; re-pointing it would rewrite a finished story for no operational gain.
 *
 * Talks to the EntityManager rather than the conversation repository for the same reason as the pending
 * dispatch resolver: injecting InboxModule into AudienceModule would close a module cycle through
 * ContentModule. Tenant isolation is unaffected — `conversations` inherits the default-on filter.
 */
@Injectable()
export class ConversationChannelMigrator implements ConversationMigratorPort {
  private readonly logger = new Logger(ConversationChannelMigrator.name);

  async migrateForChannel(input: {
    accountId: string;
    fromChannelId: string;
    reassignments: ReadonlyMap<string, string>;
  }): Promise<number> {
    // Grouped by destination so it is one UPDATE per target channel.
    const byTarget = new Map<string, string[]>();
    for (const [contactId, channelId] of input.reassignments) {
      const list = byTarget.get(channelId) ?? [];
      list.push(contactId);
      byTarget.set(channelId, list);
    }

    let moved = 0;
    for (const [channelId, contactIds] of byTarget) {
      moved += await this.em.nativeUpdate(
        ConversationOrmEntity,
        {
          channelId: input.fromChannelId,
          contactId: { $in: contactIds },
          status: { $in: [ConversationStatus.PENDING_REPLY, ConversationStatus.IN_PROGRESS] },
        },
        { channelId },
      );
    }

    if (moved > 0) {
      this.logger.warn('Conversas abertas movidas para o novo remetente', {
        fromChannelId: input.fromChannelId,
        moved,
      });
    }

    return moved;
  }

  constructor(private readonly em: EntityManager) {}
}
