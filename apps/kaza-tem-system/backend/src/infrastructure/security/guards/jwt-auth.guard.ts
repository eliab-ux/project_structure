import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { TOKEN_SERVICE, TokenServicePort, AuthTokenPayload } from '../ports/token-service.port';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.resolveToken(request.headers?.authorization);
    const payload = await this.tokenService.verifyAccessToken(token);
    request.user = payload as AuthTokenPayload;
    return true;
  }

  protected resolveToken(authorization?: string): string {
    if (
      !authorization ||
      typeof authorization !== 'string' ||
      !authorization.startsWith('Bearer ')
    ) {
      throw new ForbiddenException('Token ausente ou inválido');
    }

    return authorization.split(' ')[1];
  }
}
