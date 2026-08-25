import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AccountModule } from '../account/account.module';
import { AudienceModule } from '../audience/audience.module';
import { ChannelModule } from '../channel/channel.module';
import { InboxConfig } from '../../config/inbox.config';
import {
  CONVERSATION_REPOSITORY,
  INBOUND_MEDIA_DOWNLOADER,
  MESSAGE_REPOSITORY,
  QUICK_REPLY_REPOSITORY,
} from './application/ports/output/inbox-repositories.port';
import { IngestInboundMessageUseCase } from './application/use-cases/ingest-inbound-message/ingest-inbound-message.use-case';
import { SendReplyUseCase } from './application/use-cases/send-reply/send-reply.use-case';
import {
  GetInboxCountersUseCase,
  ListInboxQueueUseCase,
  OpenConversationUseCase,
  ReleaseExpiredLocksUseCase,
  ResolveConversationUseCase,
} from './application/use-cases/manage-conversation/manage-conversation.use-cases';
import {
  DeleteQuickReplyUseCase,
  ListQuickRepliesUseCase,
  SaveQuickReplyUseCase,
} from './application/use-cases/manage-quick-replies/manage-quick-replies.use-cases';
import { ConversationOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/conversation-orm.entity';
import { MessageOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/message-orm.entity';
import { QuickReplyOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/quick-reply-orm.entity';
import {
  MikroOrmConversationRepository,
  MikroOrmMessageRepository,
  MikroOrmQuickReplyRepository,
} from '../../infrastructure/persistence/mikro-orm/repositories/inbox.repositories';
import { InboundMediaDownloader } from '../../infrastructure/storage/inbound-media-downloader.adapter';

/**
 * The inbox (FASE 8).
 *
 * AudienceModule is imported for two things and both are load-bearing: the contact repository (an inbound
 * message is only accepted from a number already in the base) and `HandleInboundOptOutUseCase`, which owns
 * the §6.5 automation. The classifier detects an opt-out; it does not implement one.
 *
 * Note what is NOT imported: DistributionModule. The inbox never sends a campaign message and never reads
 * a plan — it borrows nothing from the distribution side, which is why the two can grow independently.
 */
@Module({
  imports: [
    ConfigModule,
    MikroOrmModule.forFeature([ConversationOrmEntity, MessageOrmEntity, QuickReplyOrmEntity]),
    AudienceModule,
    ChannelModule,
    AccountModule,
  ],
  providers: [
    InboxConfig,
    { provide: CONVERSATION_REPOSITORY, useClass: MikroOrmConversationRepository },
    { provide: MESSAGE_REPOSITORY, useClass: MikroOrmMessageRepository },
    { provide: QUICK_REPLY_REPOSITORY, useClass: MikroOrmQuickReplyRepository },
    { provide: INBOUND_MEDIA_DOWNLOADER, useClass: InboundMediaDownloader },
    IngestInboundMessageUseCase,
    SendReplyUseCase,
    ListInboxQueueUseCase,
    OpenConversationUseCase,
    ResolveConversationUseCase,
    GetInboxCountersUseCase,
    ReleaseExpiredLocksUseCase,
    SaveQuickReplyUseCase,
    ListQuickRepliesUseCase,
    DeleteQuickReplyUseCase,
  ],
  exports: [
    InboxConfig,
    CONVERSATION_REPOSITORY,
    MESSAGE_REPOSITORY,
    IngestInboundMessageUseCase,
    SendReplyUseCase,
    ListInboxQueueUseCase,
    OpenConversationUseCase,
    ResolveConversationUseCase,
    GetInboxCountersUseCase,
    ReleaseExpiredLocksUseCase,
    SaveQuickReplyUseCase,
    ListQuickRepliesUseCase,
    DeleteQuickReplyUseCase,
  ],
})
export class InboxModule {}
