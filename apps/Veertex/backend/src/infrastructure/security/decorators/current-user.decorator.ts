import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthTokenPayload } from '../../../contexts/auth/application/ports/output/token-service.port';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';

/**
 * The authenticated user, as signed in the token. Controllers read `accountId` from here — never
 * from a DTO field, which is why no request DTO in this system has one.
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

/** Client IP for the audit trail. Fastify's trustProxy makes this the real client behind Traefik. */
export const ClientIp = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null => {
    const request = context.switchToHttp().getRequest<{ ip?: string }>();
    return request.ip ?? null;
  },
);
