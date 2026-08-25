import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountModule } from '../../contexts/account/account.module';
import { AudienceModule } from '../../contexts/audience/audience.module';
import { AuthModule } from '../../contexts/auth/auth.module';
import { ChannelModule } from '../../contexts/channel/channel.module';
import { ContentModule } from '../../contexts/content/content.module';
import { ApprovalModule } from '../../contexts/approval/approval.module';
import { DistributionModule } from '../../contexts/distribution/distribution.module';
import { DispatchModule } from '../../contexts/dispatch/dispatch.module';
import { InboxModule } from '../../contexts/inbox/inbox.module';
import { PlatformModule } from '../../contexts/platform/platform.module';
import { UserModule } from '../../contexts/user/user.module';
import { MessagingModule } from '../messaging/messaging.module';
import { HealthController } from './controllers/health/health.controller';
import { AuthController } from './controllers/auth/auth.controller';
import { AccountController } from './controllers/account/account.controller';
import { UserController } from './controllers/user/user.controller';
import { PlatformController } from './controllers/platform/platform.controller';
import { ChannelController } from './controllers/channel/channel.controller';
import { ContactController } from './controllers/contact/contact.controller';
import { ContentController } from './controllers/content/content.controller';
import { ApprovalController } from './controllers/approval/approval.controller';
import { PublicApprovalController } from './controllers/approval/public-approval.controller';
import { DistributionController } from './controllers/distribution/distribution.controller';
import { InboxController } from './controllers/inbox/inbox.controller';
import { AuditController } from './controllers/audit/audit.controller';
import { EvolutionWebhookController } from './controllers/webhook/evolution-webhook.controller';
import { EvolutionWebhookService } from './controllers/webhook/evolution-webhook.service';

/**
 * The HTTP inbound adapter. Controllers stay thin: validate (DTO), call the use case, map to a
 * ResponseDto. No business logic here.
 *
 * Public routes and why, all of them: `/health` (liveness probe), `/auth/login`, `/auth/refresh`,
 * `/auth/request-password-reset`, `/auth/reset-password` and `/platform/auth/login` — each is a
 * point where the caller cannot yet be authenticated — plus `/webhooks/evolution`, whose caller is
 * the Evolution server and which is authenticated by a shared token instead of a JWT — plus
 * `/public/approvals/:token`, the approval magic link, whose caller is an approver who may have no
 * account at all and which is protected by a single-use hashed token plus a rate limit (see
 * PublicApprovalController for the full reasoning). Every other route carries JwtAuthGuard,
 * AccountAdminGuard or PlatformAdminGuard.
 */
@Module({
  imports: [
    ConfigModule,
    AuthModule,
    AccountModule,
    UserModule,
    PlatformModule,
    ChannelModule,
    AudienceModule,
    ContentModule,
    ApprovalModule,
    DistributionModule,
    DispatchModule,
    InboxModule,
    // For TenantScopedJobRunner (the webhook needs a tenant scope without a JWT) and for the
    // contact-import queue the controller enqueues to.
    MessagingModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    AccountController,
    UserController,
    PlatformController,
    ChannelController,
    ContactController,
    ContentController,
    ApprovalController,
    PublicApprovalController,
    DistributionController,
    InboxController,
    AuditController,
    EvolutionWebhookController,
  ],
  providers: [EvolutionWebhookService],
})
export class HttpModule {}
