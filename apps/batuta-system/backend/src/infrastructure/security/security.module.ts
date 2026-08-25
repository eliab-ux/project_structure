import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PASSWORD_HASHER } from '../../contexts/auth/application/ports/output/password-hasher.port';
import { TOKEN_SERVICE } from '../../contexts/auth/application/ports/output/token-service.port';
import { BcryptPasswordHasher } from './bcrypt-password-hasher.service';
import { JwtTokenService } from './jwt-token.service';
import { TenantContextService } from './tenant-context.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AccountAdminGuard } from './guards/account-admin.guard';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { EvolutionWebhookGuard } from './guards/evolution-webhook.guard';
import { WebhookRejectionLog } from './webhook-rejection.log';

/**
 * Global so every controller can use the guards without re-importing, and so TenantContextService
 * is a single instance resolving the request-scoped EntityManager fork.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    TenantContextService,
    JwtAuthGuard,
    AccountAdminGuard,
    PlatformAdminGuard,
    // Registered explicitly (it used to be instantiated only by `@UseGuards(Class)`) so that it and the
    // diagnosis share ONE WebhookRejectionLog. Two instances would mean the screen reading a counter
    // that nothing increments.
    EvolutionWebhookGuard,
    WebhookRejectionLog,
  ],
  exports: [
    TOKEN_SERVICE,
    PASSWORD_HASHER,
    TenantContextService,
    JwtAuthGuard,
    AccountAdminGuard,
    PlatformAdminGuard,
    EvolutionWebhookGuard,
    WebhookRejectionLog,
  ],
})
export class SecurityModule {}
