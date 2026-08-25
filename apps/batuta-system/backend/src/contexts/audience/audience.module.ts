import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ChannelModule } from '../channel/channel.module';
import { CONTACT_REPOSITORY } from './application/ports/output/contact-repository.port';
import { DispatchPendingResolver } from '../../infrastructure/persistence/pending-dispatch-resolver.adapter';
import { ConversationChannelMigrator } from '../../infrastructure/persistence/conversation-migrator.adapter';
import {
  CONTACT_FILE_PARSER,
  CONTACT_IMPORT_REPOSITORY,
  CONTACT_SENDER_HISTORY_REPOSITORY,
  CONVERSATION_MIGRATOR,
  PENDING_DISPATCH_RESOLVER,
  SENDER_MIGRATION_REPOSITORY,
} from './application/ports/output/contact-import.ports';
import { StartContactImportUseCase } from './application/use-cases/start-contact-import/start-contact-import.use-case';
import { ProcessContactImportUseCase } from './application/use-cases/process-contact-import/process-contact-import.use-case';
import { GetContactImportUseCase } from './application/use-cases/get-contact-import/get-contact-import.use-case';
import { ListContactImportsUseCase } from './application/use-cases/list-contact-imports/list-contact-imports.use-case';
import { ListSenderMigrationsUseCase } from './application/use-cases/list-sender-migrations/list-sender-migrations.use-case';
import { ListContactsUseCase } from './application/use-cases/list-contacts/list-contacts.use-case';
import { GetContactUseCase } from './application/use-cases/get-contact/get-contact.use-case';
import { GetChannelLoadsUseCase } from './application/use-cases/get-channel-loads/get-channel-loads.use-case';
import { ListContactTagsUseCase } from './application/use-cases/list-contact-tags/list-contact-tags.use-case';
import { DeleteContactUseCase } from './application/use-cases/delete-contact/delete-contact.use-case';
import { CONTACT_USAGE } from './application/ports/output/contact-usage.port';
import { ContactUsageAdapter } from '../../infrastructure/persistence/contact-usage.adapter';
import { PreviewSenderMigrationUseCase } from './application/use-cases/preview-sender-migration/preview-sender-migration.use-case';
import { ExecuteSenderMigrationUseCase } from './application/use-cases/execute-sender-migration/execute-sender-migration.use-case';
import { OptOutContactUseCase } from './application/use-cases/opt-out-contact/opt-out-contact.use-case';
import { DeactivateContactUseCase } from './application/use-cases/set-contact-routing/deactivate-contact.use-case';
import { ReactivateContactUseCase } from './application/use-cases/set-contact-routing/reactivate-contact.use-case';
import { HandleInboundOptOutUseCase } from './application/use-cases/handle-inbound-opt-out/handle-inbound-opt-out.use-case';
import { ContactOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/contact-orm.entity';
import { ContactImportOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/contact-import-orm.entity';
import { ContactImportErrorOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/contact-import-error-orm.entity';
import { ContactSenderHistoryOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/contact-sender-history-orm.entity';
import { SenderMigrationOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/sender-migration-orm.entity';
import {
  ContactImportMapper,
  ContactMapper,
  SenderMigrationMapper,
} from '../../infrastructure/persistence/mikro-orm/mappers/contact.mapper';
import { MikroOrmContactRepository } from '../../infrastructure/persistence/mikro-orm/repositories/contact.repository';
import {
  MikroOrmContactImportRepository,
  MikroOrmContactSenderHistoryRepository,
  MikroOrmSenderMigrationRepository,
} from '../../infrastructure/persistence/mikro-orm/repositories/audience.repositories';
import { ContactFileParser } from '../../infrastructure/import/contact-file.parser';

/**
 * Contacts, imports, allocation and sender migration (FASE 3).
 *
 * ChannelModule is imported because allocation and migration both need the channel list and their
 * statuses — the eligibility rule of §6.2 is "CONNECTED only", and it is the channel context that
 * knows what CONNECTED means.
 */
@Module({
  imports: [
    MikroOrmModule.forFeature([
      ContactOrmEntity,
      ContactImportOrmEntity,
      ContactImportErrorOrmEntity,
      ContactSenderHistoryOrmEntity,
      SenderMigrationOrmEntity,
    ]),
    ChannelModule,
  ],
  providers: [
    ContactMapper,
    ContactImportMapper,
    SenderMigrationMapper,
    { provide: CONTACT_REPOSITORY, useClass: MikroOrmContactRepository },
    { provide: CONTACT_IMPORT_REPOSITORY, useClass: MikroOrmContactImportRepository },
    {
      provide: CONTACT_SENDER_HISTORY_REPOSITORY,
      useClass: MikroOrmContactSenderHistoryRepository,
    },
    { provide: SENDER_MIGRATION_REPOSITORY, useClass: MikroOrmSenderMigrationRepository },
    { provide: CONTACT_FILE_PARSER, useClass: ContactFileParser },
    // §6.4 items 5 and 6 — replaced by the real implementations in FASE 6/7 and FASE 8. See the
    // adapters' docblocks for why the seam exists now.
    // FASE 7: the real resolver, replacing the FASE 3 no-op now that `dispatches` exists (§6.4 item 5).
    { provide: PENDING_DISPATCH_RESOLVER, useClass: DispatchPendingResolver },
    // FASE 8: o migrator real, substituindo o no-op da FASE 3 (§6.4 item 6).
    { provide: CONVERSATION_MIGRATOR, useClass: ConversationChannelMigrator },
    // Diz ao contexto de audiência se o contato já aparece num envio, sem que ele importe a
    // persistência do contexto de distribuição.
    { provide: CONTACT_USAGE, useClass: ContactUsageAdapter },
    StartContactImportUseCase,
    ProcessContactImportUseCase,
    GetContactImportUseCase,
    ListContactImportsUseCase,
    ListSenderMigrationsUseCase,
    ListContactsUseCase,
    GetContactUseCase,
    GetChannelLoadsUseCase,
    ListContactTagsUseCase,
    DeleteContactUseCase,
    PreviewSenderMigrationUseCase,
    ExecuteSenderMigrationUseCase,
    OptOutContactUseCase,
    DeactivateContactUseCase,
    ReactivateContactUseCase,
    HandleInboundOptOutUseCase,
  ],
  exports: [
    CONTACT_REPOSITORY,
    CONTACT_IMPORT_REPOSITORY,
    CONTACT_SENDER_HISTORY_REPOSITORY,
    SENDER_MIGRATION_REPOSITORY,
    StartContactImportUseCase,
    ProcessContactImportUseCase,
    GetContactImportUseCase,
    ListContactImportsUseCase,
    ListSenderMigrationsUseCase,
    ListContactsUseCase,
    GetContactUseCase,
    GetChannelLoadsUseCase,
    ListContactTagsUseCase,
    DeleteContactUseCase,
    PreviewSenderMigrationUseCase,
    ExecuteSenderMigrationUseCase,
    OptOutContactUseCase,
    DeactivateContactUseCase,
    ReactivateContactUseCase,
    HandleInboundOptOutUseCase,
  ],
})
export class AudienceModule {}
