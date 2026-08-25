import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from '../auth/auth.module';
import { ContentModule } from '../content/content.module';
import { MessagingModule } from '../../infrastructure/messaging/messaging.module';
import {
  APPROVAL_REQUEST_REPOSITORY,
  APPROVAL_SETTINGS_REPOSITORY,
  APPROVER_REPOSITORY,
  CONTENT_AUTHOR_PROVIDER,
} from './application/ports/output/approval-repositories.port';
import { SYSTEM_NOTIFIER } from './application/ports/output/system-notifier.port';
import { GetApprovalSettingsUseCase } from './application/use-cases/get-approval-settings/get-approval-settings.use-case';
import { UpdateApprovalSettingsUseCase } from './application/use-cases/update-approval-settings/update-approval-settings.use-case';
import { CreateApproverUseCase } from './application/use-cases/create-approver/create-approver.use-case';
import { UpdateApproverUseCase } from './application/use-cases/update-approver/update-approver.use-case';
import { ListApproversUseCase } from './application/use-cases/list-approvers/list-approvers.use-case';
import { SubmitForApprovalUseCase } from './application/use-cases/submit-for-approval/submit-for-approval.use-case';
import { DecideApprovalUseCase } from './application/use-cases/decide-approval/decide-approval.use-case';
import { GetApprovalPageUseCase } from './application/use-cases/get-approval-page/get-approval-page.use-case';
import { GetApprovalMediaUseCase } from './application/use-cases/get-approval-media/get-approval-media.use-case';
import { ListApprovalRequestsUseCase } from './application/use-cases/list-approval-requests/list-approval-requests.use-case';
import { InvalidateApprovalsOnContentChangeHandler } from './application/use-cases/invalidate-approvals/invalidate-approvals-on-content-change.handler';
import { ApprovalRequestOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/approval-request-orm.entity';
import { ApprovalSettingsOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/approval-settings-orm.entity';
import { ApproverOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/approver-orm.entity';
import {
  MikroOrmApprovalRequestRepository,
  MikroOrmApprovalSettingsRepository,
  MikroOrmApproverRepository,
  MikroOrmContentAuthorProvider,
} from '../../infrastructure/persistence/mikro-orm/repositories/approval.repositories';
import { SystemNotifierAdapter } from '../../infrastructure/notifications/system-notifier.adapter';

/**
 * Approval (FASE 5).
 *
 * Three imports, three reasons:
 *  - **ContentModule** — the flow reads and writes the content aggregate (status transitions) and reuses
 *    its contact-sample adapter for the rendered sample on the public page;
 *  - **AuthModule** — for `MAIL_SENDER`, the platform's own SMTP. The SYSTEM notifier uses it directly
 *    and deliberately has no access to the tenant Evolution resolver (§8 item 3);
 *  - **MessagingModule** — for `TenantScopedJobRunner`, needed twice over: the invalidation handler runs
 *    on an event with no request, and the magic-link routes run with no JWT.
 */
@Module({
  imports: [
    ConfigModule,
    MikroOrmModule.forFeature([
      ApprovalSettingsOrmEntity,
      ApproverOrmEntity,
      ApprovalRequestOrmEntity,
    ]),
    ContentModule,
    AuthModule,
    MessagingModule,
  ],
  providers: [
    { provide: APPROVAL_SETTINGS_REPOSITORY, useClass: MikroOrmApprovalSettingsRepository },
    { provide: APPROVER_REPOSITORY, useClass: MikroOrmApproverRepository },
    { provide: APPROVAL_REQUEST_REPOSITORY, useClass: MikroOrmApprovalRequestRepository },
    { provide: CONTENT_AUTHOR_PROVIDER, useClass: MikroOrmContentAuthorProvider },
    { provide: SYSTEM_NOTIFIER, useClass: SystemNotifierAdapter },
    GetApprovalSettingsUseCase,
    UpdateApprovalSettingsUseCase,
    CreateApproverUseCase,
    UpdateApproverUseCase,
    ListApproversUseCase,
    SubmitForApprovalUseCase,
    DecideApprovalUseCase,
    GetApprovalPageUseCase,
    GetApprovalMediaUseCase,
    ListApprovalRequestsUseCase,
    // Reacts to the content context's invalidation event (§8.5). Registered here so the approval side
    // owns the consequence, while the content side only announces the fact.
    InvalidateApprovalsOnContentChangeHandler,
  ],
  exports: [
    GetApprovalSettingsUseCase,
    UpdateApprovalSettingsUseCase,
    CreateApproverUseCase,
    UpdateApproverUseCase,
    ListApproversUseCase,
    SubmitForApprovalUseCase,
    DecideApprovalUseCase,
    GetApprovalPageUseCase,
    GetApprovalMediaUseCase,
    ListApprovalRequestsUseCase,
    // Exported for FASE 6: planning must refuse content that is not APPROVED, and the dispatch context
    // will read the settings to explain why.
    APPROVAL_SETTINGS_REPOSITORY,
    APPROVAL_REQUEST_REPOSITORY,
  ],
})
export class ApprovalModule {}
