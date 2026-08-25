import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthTokenPayload } from '../../../contexts/auth/application/ports/output/token-service.port';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';
import { PlatformRequest } from '../guards/platform-admin.guard';

/**
 * The authenticated tenant user, as signed in the token. Controllers read `accountId` from here —
 * never from a DTO field, which is why no request DTO in this system has an accountId.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthTokenPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      // Reaching here means the route has no JwtAuthGuard — a wiring bug, not a client error.
      throw new Error('CurrentUser usado em rota sem JwtAuthGuard.');
    }
    return request.user;
  },
);

/** The authenticated platform admin. Only valid behind PlatformAdminGuard. */
export const CurrentPlatformAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): { sub: string } => {
    const request = context.switchToHttp().getRequest<PlatformRequest>();
    if (!request.platformAdmin) {
      throw new Error('CurrentPlatformAdmin usado em rota sem PlatformAdminGuard.');
    }
    return request.platformAdmin;
  },
);

/** Client IP for the audit trail. Fastify's trustProxy makes this the real client behind Traefik. */
export const ClientIp = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    const request = context.switchToHttp().getRequest<{ ip?: string }>();
    return request.ip ?? null;
  },
);

/**
 * User-Agent, recorded next to an approval decision (§8 item 4).
 *
 * Truncated because it is attacker-controlled free text heading for a database column and a log line;
 * the column is 300 chars, so the cut happens here rather than as a database error.
 */
export const ClientUserAgent = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    const request = context
      .switchToHttp()
      .getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
    const raw = request.headers?.['user-agent'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value.length > 0 ? value.slice(0, 300) : null;
  },
);
