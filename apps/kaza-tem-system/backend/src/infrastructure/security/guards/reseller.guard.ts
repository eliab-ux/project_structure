import { ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { AuthTokenPayload, TOKEN_SERVICE, TokenServicePort } from '../ports/token-service.port';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class ResellerGuard extends JwtAuthGuard {
  constructor(@Inject(TOKEN_SERVICE) tokenService: TokenServicePort) {
    super(tokenService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest();
    const payload = request.user as AuthTokenPayload;
    if (payload.role !== 'reseller' || !payload.resellerId) {
      throw new ForbiddenException('Acesso restrito a revendedores');
    }
    return true;
  }
}
