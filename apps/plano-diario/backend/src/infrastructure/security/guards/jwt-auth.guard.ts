import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthTokenPayload, TOKEN_SERVICE, TokenServicePort } from '../ports/token-service.port';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.resolveToken(request.headers?.authorization);
    try {
      request.user = (await this.tokenService.verifyAccessToken(token)) as AuthTokenPayload;
    } catch {
      // Mensagem uniforme: não diz se o token é malformado, expirado ou de outra chave.
      throw new UnauthorizedException('Token inválido ou expirado');
    }
    return true;
  }

  protected resolveToken(authorization?: string): string {
    if (
      !authorization ||
      typeof authorization !== 'string' ||
      !authorization.startsWith('Bearer ')
    ) {
      throw new UnauthorizedException('Token ausente');
    }
    return authorization.slice('Bearer '.length);
  }
}
