import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthTokenPayload } from '../ports/token-service.port';

/**
 * Extrai o usuário autenticado da request (populado pelo JwtAuthGuard).
 * O id do usuário é sempre `payload.sub` — nunca um valor vindo de body/query.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthTokenPayload => {
    const request = context.switchToHttp().getRequest();
    return request.user as AuthTokenPayload;
  },
);
