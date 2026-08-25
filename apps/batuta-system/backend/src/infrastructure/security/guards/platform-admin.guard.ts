import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import {
  PlatformTokenPayload,
  TOKEN_SERVICE,
  TokenServicePort,
} from '../../../contexts/auth/application/ports/output/token-service.port';
import { TenantContextService } from '../tenant-context.service';
import { extractBearerToken } from './jwt-auth.guard';

export interface PlatformRequest extends FastifyRequest {
  platformAdmin?: PlatformTokenPayload;
}

/**
 * Requires a PLATFORM token. A tenant token fails here (wrong `typ` and no `scope`), and a
 * platform token fails in JwtAuthGuard — the two worlds never satisfy each other's guards.
 *
 * Note what it does NOT do: it does not establish a tenant scope. A platform request that
 * accidentally queries a business entity therefore throws instead of reading every tenant's rows.
 * Cross-tenant reads must go through an explicitly named platform repository method.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    private readonly tenantContext: TenantContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PlatformRequest>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Autenticação de plataforma obrigatória.');
    }

    request.platformAdmin = this.tokens.verifyPlatformAccessToken(token);
    this.tenantContext.establishPlatformScope();
    return true;
  }
}
