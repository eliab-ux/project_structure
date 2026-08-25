import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthTokenPayload } from '../ports/token-service.port';

/**
 * JwtAuthGuard + exige role === 'psicologo'. Área do profissional.
 */
@Injectable()
export class PsicologoGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthTokenPayload;
    if (user?.role !== 'psicologo') {
      throw new ForbiddenException('Acesso restrito a psicólogos.');
    }
    return true;
  }
}
