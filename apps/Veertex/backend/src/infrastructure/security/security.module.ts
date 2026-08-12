import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PASSWORD_HASHER } from '../../contexts/auth/application/ports/output/password-hasher.port';
import { TOKEN_SERVICE } from '../../contexts/auth/application/ports/output/token-service.port';
import { LOGIN_THROTTLE } from '../../contexts/auth/application/ports/output/login-throttle.port';
import { InMemoryLoginThrottle } from './in-memory-login-throttle';
import { TENANT_SCOPE } from '../../contexts/auth/application/ports/output/tenant-scope.port';
import { BcryptPasswordHasher } from './bcrypt-password-hasher.service';
import { JwtTokenService } from './jwt-token.service';
import { TenantContextService } from './tenant-context.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { ModuleGuard } from './guards/module.guard';

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
    // Em memória e, por isso, SINGLETON do processo — o Nest já garante isso, e é o que faz os
    // contadores persistirem entre requisições. Ver o docblock do adapter para o que essa escolha
    // protege e o que não protege.
    { provide: LOGIN_THROTTLE, useClass: InMemoryLoginThrottle },
    TenantContextService,
    // The auth use cases depend on the PORT; the concrete service is the same instance the guards
    // use, so the scope they establish is the scope the request already carries.
    { provide: TENANT_SCOPE, useExisting: TenantContextService },
    JwtAuthGuard,
    PermissionGuard,
    ModuleGuard,
  ],
  exports: [
    TOKEN_SERVICE,
    PASSWORD_HASHER,
    LOGIN_THROTTLE,
    TENANT_SCOPE,
    TenantContextService,
    JwtAuthGuard,
    PermissionGuard,
    ModuleGuard,
  ],
})
export class SecurityModule {}
