import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthTokenPayload } from '../ports/token-service.port';

/**
 * Extracts the authenticated tenant from the request (populated by JwtAuthGuard).
 * The tenant id is always `payload.sub` — never a value coming from body/query.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthTokenPayload => {
    const request = context.switchToHttp().getRequest();
    return request.user as AuthTokenPayload;
  },
);
