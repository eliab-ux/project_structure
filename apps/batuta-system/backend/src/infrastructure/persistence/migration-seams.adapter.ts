import { Injectable, Logger } from '@nestjs/common';
import {
  ConversationMigratorPort,
  PendingDispatchResolverPort,
} from '../../contexts/audience/application/ports/output/contact-import.ports';

/**
 * FASE 3 placeholder for §6.4 item 5.
 *
 * The obligation is real and stated in the spec — "Dispatches pendentes do canal morto: resolver
 * explicitamente. Nunca deixe dispatch órfão apontando para canal terminal" — but `dispatches` only
 * exists from FASE 6/7. So the migration calls this port unconditionally today and it logs.
 *
 * When the real implementation lands, it replaces THIS provider and nothing else changes: the call
 * site, the transaction boundary and the audit payload are already in place. The seam exists so the
 * requirement is visible in code rather than remembered by a person.
 */
@Injectable()
export class NoopPendingDispatchResolver implements PendingDispatchResolverPort {
  private readonly logger = new Logger(NoopPendingDispatchResolver.name);

  async resolveForMigration(input: {
    accountId: string;
    fromChannelId: string;
    migrationId: string;
    reassignments: ReadonlyMap<string, string>;
  }): Promise<number> {
    this.logger.log(
      'Nenhum dispatch pendente a resolver: tabela dispatches chega na FASE 6/7 (§6.4 item 5)',
      { fromChannelId: input.fromChannelId, contacts: input.reassignments.size },
    );
    return 0;
  }
}

/**
 * FASE 3 placeholder for §6.4 item 6: open conversations follow their contacts, while `messages` keeps
 * the original `channel_id` of each message. `conversations` arrives in FASE 8 — same seam reasoning
 * as above.
 */
@Injectable()
export class NoopConversationMigrator implements ConversationMigratorPort {
  private readonly logger = new Logger(NoopConversationMigrator.name);

  async migrateForChannel(input: {
    accountId: string;
    fromChannelId: string;
    reassignments: ReadonlyMap<string, string>;
  }): Promise<number> {
    this.logger.log(
      'Nenhuma conversa a migrar: tabela conversations chega na FASE 8 (§6.4 item 6)',
      { fromChannelId: input.fromChannelId, contacts: input.reassignments.size },
    );
    return 0;
  }
}
