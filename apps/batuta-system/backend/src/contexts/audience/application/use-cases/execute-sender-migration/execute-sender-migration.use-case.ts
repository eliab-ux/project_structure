import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  CHANNEL_REPOSITORY,
  ChannelRepositoryPort,
} from '../../../../channel/application/ports/output/channel-repository.port';
import { ChannelId } from '../../../../channel/domain/value-objects/channel-id.vo';
import { acceptsNewContacts } from '../../../../channel/domain/value-objects/channel-status.vo';
import { ChannelNotFoundException } from '../../../../channel/domain/exceptions/channel-not-found.exception';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import {
  EVENT_PUBLISHER,
  EventPublisherPort,
} from '../../../../../infrastructure/persistence/ports/event-publisher.port';
import {
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from '../../../../../infrastructure/persistence/ports/unit-of-work.port';
import { SenderMigration } from '../../../domain/entities/sender-migration.entity';
import { ChannelAllocator, ChannelLoad } from '../../../domain/services/channel-allocator';
import { AllocationReason } from '../../../domain/value-objects/allocation-reason.vo';
import { MigrationStrategy } from '../../../domain/value-objects/migration-strategy.vo';
import { InvalidMigrationTargetException } from '../../../domain/exceptions/migration-not-eligible.exception';
import { SenderMigrationDto } from '../../dto/contact.dto';
import {
  CONTACT_SENDER_HISTORY_REPOSITORY,
  CONVERSATION_MIGRATOR,
  ContactSenderHistoryRepositoryPort,
  ConversationMigratorPort,
  PENDING_DISPATCH_RESOLVER,
  PendingDispatchResolverPort,
  SENDER_MIGRATION_REPOSITORY,
  SenderMigrationRepositoryPort,
} from '../../ports/output/contact-import.ports';
import {
  CONTACT_REPOSITORY,
  ContactRepositoryPort,
} from '../../ports/output/contact-repository.port';
import { ExecuteSenderMigrationCommand } from './execute-sender-migration.command';

/**
 * Executes a sender migration (§6.4) — the ONLY path by which contacts change chip.
 *
 * Everything happens in ONE transaction, and the order is the point:
 *  1. plan the migration (the entity refuses a non-terminal source, §6.4 item 1);
 *  2. move each contact through `migrateSender()`, which demands the migration id;
 *  3. close the old history stay and open the new one — §4: "Nunca sobrescreva `current_channel_id`
 *     sem gravar aqui";
 *  4. resolve pending dispatches of the dead channel (§6.4 item 5) — never leave an orphan pointing
 *     at a terminal channel;
 *  5. move open conversations (§6.4 item 6).
 *
 * Steps 4 and 5 go through ports whose real implementations arrive with FASE 6/7 and FASE 8. They are
 * called unconditionally today, against no-op adapters that log, so the obligation lives in code
 * rather than in someone's memory — and when the tables exist there is nothing to remember to wire.
 */
@Injectable()
export class ExecuteSenderMigrationUseCase implements UseCase<
  ExecuteSenderMigrationCommand,
  SenderMigrationDto
> {
  private readonly logger = new Logger(ExecuteSenderMigrationUseCase.name);

  constructor(
    @Inject(CHANNEL_REPOSITORY) private readonly channels: ChannelRepositoryPort,
    @Inject(CONTACT_REPOSITORY) private readonly contacts: ContactRepositoryPort,
    @Inject(CONTACT_SENDER_HISTORY_REPOSITORY)
    private readonly history: ContactSenderHistoryRepositoryPort,
    @Inject(SENDER_MIGRATION_REPOSITORY)
    private readonly migrations: SenderMigrationRepositoryPort,
    @Inject(PENDING_DISPATCH_RESOLVER)
    private readonly pendingDispatches: PendingDispatchResolverPort,
    @Inject(CONVERSATION_MIGRATOR) private readonly conversations: ConversationMigratorPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWorkPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherPort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: ExecuteSenderMigrationCommand): Promise<SenderMigrationDto> {
    const from = await this.channels.findById(ChannelId.from(command.fromChannelId));
    if (!from) {
      throw new ChannelNotFoundException();
    }

    // Throws MigrationNotEligibleException for a non-terminal source — the DISCONNECTED guard.
    const migration = SenderMigration.plan({
      accountId: command.accountId,
      fromChannelId: from.id.value,
      fromChannelStatus: from.status,
      strategy: command.strategy,
      toChannelId: command.toChannelId,
      requestedBy: command.performedBy,
      // v1: the ACCOUNT_ADMIN who executes IS the human approval §6.4 item 4 requires.
      approvedBy: command.performedBy,
    });

    const destinations = (await this.channels.listByAccount()).filter(
      (channel) => channel.id.value !== from.id.value && acceptsNewContacts(channel.status),
    );

    if (destinations.length === 0) {
      throw new InvalidMigrationTargetException(
        'Nenhum outro canal conectado para receber os contatos. Conecte um chip antes de migrar.',
      );
    }

    if (command.strategy === MigrationStrategy.ALL_TO_ONE) {
      const target = destinations.find((channel) => channel.id.value === command.toChannelId);
      if (!target) {
        throw new InvalidMigrationTargetException(
          'Canal de destino inválido: escolha um canal conectado diferente do de origem.',
        );
      }
    }

    const movable = (await this.contacts.listByChannel(from.id.value)).filter(
      // An opted-out contact is not re-homed: that would quietly put them back in a routing table.
      (contact) => contact.isRoutable,
    );

    const counts = await this.contacts.countByChannel();
    const loadByChannel = new Map(counts.map((count) => [count.channelId, count.contacts]));
    const allocator = new ChannelAllocator(
      destinations.map<ChannelLoad>((channel) => ({
        channelId: channel.id.value,
        allocatedContacts: loadByChannel.get(channel.id.value) ?? 0,
        createdAt: channel.createdAt,
      })),
    );

    const result = await this.unitOfWork.execute(async () => {
      const saved = await this.migrations.save(migration);
      const reassignments = new Map<string, string>();

      for (const contact of movable) {
        const toChannelId =
          command.strategy === MigrationStrategy.ALL_TO_ONE
            ? (command.toChannelId as string)
            : allocator.allocateOne().channelId;

        contact.migrateSender(toChannelId, saved.id);
        await this.contacts.save(contact);
        reassignments.set(contact.id.value, toChannelId);
      }

      if (movable.length > 0) {
        // Close the stay on the dead channel, then open the new one. Two calls, one transaction.
        await this.history.releaseOpenEntries(
          movable.map((contact) => contact.id.value),
          from.id.value,
        );
        await this.history.appendMany(
          command.accountId,
          movable.map((contact) => ({
            contactId: contact.id.value,
            channelId: reassignments.get(contact.id.value) as string,
            reason: AllocationReason.MIGRATION,
            migrationId: saved.id,
          })),
        );
      }

      // §6.4 items 5 and 6 — seams until FASE 6/7/8 (see the ports' docblocks).
      const dispatchesResolved = await this.pendingDispatches.resolveForMigration({
        accountId: command.accountId,
        fromChannelId: from.id.value,
        migrationId: saved.id,
        reassignments,
      });
      const conversationsMoved = await this.conversations.migrateForChannel({
        accountId: command.accountId,
        fromChannelId: from.id.value,
        reassignments,
      });

      saved.markExecuted(movable.length);
      const executed = await this.migrations.save(saved);

      return { executed, movable, dispatchesResolved, conversationsMoved };
    });

    for (const contact of result.movable) {
      await this.events.publishAll(contact.pullDomainEvents());
    }

    await this.audit.execute({
      accountId: command.accountId,
      actorType: AuditActorType.USER,
      actorId: command.performedBy,
      action: AuditAction.SENDER_MIGRATION_EXECUTED,
      entityType: 'sender_migration',
      entityId: result.executed.id,
      ip: command.ip,
      payload: {
        fromChannelId: from.id.value,
        fromChannelStatus: from.status,
        strategy: command.strategy,
        toChannelId: command.toChannelId,
        contactsAffected: result.executed.contactsAffected,
        dispatchesResolved: result.dispatchesResolved,
        conversationsMoved: result.conversationsMoved,
        approvedBy: command.performedBy,
      },
    });

    this.logger.warn('Migração de remetente executada', {
      migrationId: result.executed.id,
      fromChannelId: from.id.value,
      contactsAffected: result.executed.contactsAffected,
    });

    return SenderMigrationDto.fromDomain(result.executed);
  }
}
