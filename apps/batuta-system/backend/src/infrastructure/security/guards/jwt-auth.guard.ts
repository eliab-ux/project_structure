import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import {
  AuthTokenPayload,
  TOKEN_SERVICE,
  TokenServicePort,
} from '../../../contexts/auth/application/ports/output/token-service.port';
import { TenantContextService } from '../tenant-context.service';

/** What the guard attaches to the request. Read it through the @CurrentUser decorator. */
export interface AuthenticatedRequest extends FastifyRequest {
  user?: AuthTokenPayload;
}

/**
 * Requires a valid tenant access token AND establishes the tenant scope for the request.
 *
 * Those two responsibilities live together on purpose: if establishing the scope were a separate,
 * optional step, someone would eventually add a guarded route without it and every query in that
 * route would run unscoped. Here, being authenticated and being scoped are the same event.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    private readonly tenantContext: TenantContextService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Autenticação obrigatória.');
    }

    // Throws UnauthorizedTokenException (→ 401) when absent, malformed, expired or of the wrong kind.
    const payload = this.tokens.verifyAccessToken(token);

    request.user = payload;
    // The accountId comes from the signed token and from nowhere else — never from body/query/header.
    this.tenantContext.establish(payload.accountId);

    return true;
  }
}

export function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || Array.isArray(header)) {
    return null;
  }
  const [scheme, value] = header.split(' ');
  if (!/^Bearer$/i.test(scheme ?? '') || !value) {
    return null;
  }
  return value.trim();
}
