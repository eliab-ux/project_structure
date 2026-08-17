import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import {
  TOKEN_SERVICE,
  TokenServicePort,
  AuthTokenPayload,
} from '../../../contexts/auth/application/ports/output/token-service.port';

/** `request.user` populado pelo guard. Nunca preenchido a partir do corpo da requisição. */
export interface AuthenticatedRequest extends FastifyRequest {
  user?: AuthTokenPayload;
}

/**
 * Exige um access token válido e popula `request.user`.
 *
 * Todo guard de papel estende este: sem identidade não há papel, e um guard de papel que
 * assumisse a autenticação feita por outro seria uma rota a menos de virar pública num refactor.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE)
    protected readonly tokenService: TokenServicePort,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de acesso ausente.');
    }

    try {
      request.user = this.tokenService.verifyAccessToken(header.slice('Bearer '.length).trim());
    } catch {
      // A causa (expirado, assinatura errada, payload malformado) fica de fora da resposta:
      // distinguir "expirado" de "inválido" ajuda mais quem forja token do que quem usa o sistema.
      throw new UnauthorizedException('Token de acesso inválido ou expirado.');
    }

    return true;
  }
}
