import {
  ExecutionContext,
  InternalServerErrorException,
  createParamDecorator,
} from '@nestjs/common';
import { AuthTokenPayload } from '../../../contexts/auth/application/ports/output/token-service.port';
import { AuthenticatedRequest } from '../guards/jwt-auth.guard';

/**
 * Entrega o payload do token ao controller.
 *
 * Se `request.user` não existir, o método está exposto sem guard — e o erro é da programação, não
 * da requisição. Levantar 500 aqui é deliberado: devolver 401 esconderia uma rota desprotegida
 * atrás de uma resposta que parece normal, e ela seguiria assim até alguém notar.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthTokenPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new InternalServerErrorException(
        'Rota sem guard de autenticação: @CurrentUser exige JwtAuthGuard.',
      );
    }

    return request.user;
  },
);
