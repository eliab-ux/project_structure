import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PASSWORD_HASHER } from '../../contexts/auth/application/ports/output/password-hasher.port';
import { TOKEN_SERVICE } from '../../contexts/auth/application/ports/output/token-service.port';
import { TENANT_SCOPE } from '../../contexts/auth/application/ports/output/tenant-scope.port';
import { BcryptPasswordHasher } from './bcrypt-password-hasher.service';
import { JwtTokenService } from './jwt-token.service';
import { TenantContextService } from './tenant-context.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';

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
    // The auth use cases depend on the PORT; the concrete service is the same instance the guards
    // use, so the scope they establish is the scope the request already carries.
    { provide: TENANT_SCOPE, useExisting: TenantContextService },
    JwtAuthGuard,
    PermissionGuard,
  ],
  exports: [
    TOKEN_SERVICE,
    PASSWORD_HASHER,
    TENANT_SCOPE,
    TenantContextService,
    JwtAuthGuard,
    PermissionGuard,
  ],
})
export class SecurityModule {}
