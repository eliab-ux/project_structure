import { ForbiddenException } from '@nestjs/common';
import { AuthTokenPayload } from '../../infrastructure/security/ports/token-service.port';

/**
 * The tenant id (owner_id) is ALWAYS the authenticated `sub` — never a value coming from
 * the request body/query. Every use case is scoped by the value returned here.
 */
export function resolveOwnerId(payload: AuthTokenPayload): string {
  if (!payload?.sub) {
    throw new ForbiddenException('Tenant não identificado');
  }
  return payload.sub;
}
