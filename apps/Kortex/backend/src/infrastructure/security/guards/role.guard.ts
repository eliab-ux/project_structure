import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../../../contexts/user/domain/value-objects/user-role.vo';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';

/**
 * Base dos guards de papel: autentica (herdado) e depois confere o papel.
 *
 * Os três guards concretos abaixo saem diretamente da tabela da §5 da spec. Vale registrar o que
 * eles NÃO cobrem: duas ações da Fase 3 são exclusivas do `modelista` mesmo para o `owner`
 * ("Definir estimated_hours"). Isso não vira guard — é regra de negócio, e vai morar no use case
 * correspondente, como já acontece com "só o owner cria outro owner".
 */
@Injectable()
export abstract class RoleGuard extends JwtAuthGuard {
  protected abstract readonly allowedRoles: readonly UserRole[];

  canActivate(context: ExecutionContext): boolean {
    super.canActivate(context);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.user?.role;

    if (!role || !this.allowedRoles.includes(role)) {
      // 403 e não 404: a rota existe e o usuário é conhecido — o que falta é permissão.
      throw new ForbiddenException('Seu papel não permite esta ação.');
    }

    return true;
  }
}
