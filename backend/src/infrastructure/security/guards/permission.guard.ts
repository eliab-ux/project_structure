import { ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from '../../../contexts/auth/application/ports/output/token-service.port';
import { grants } from '../../../contexts/role/domain/permissions.catalog';
import { TenantContextService } from '../tenant-context.service';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { REQUIRED_PERMISSIONS } from '../decorators/require-permission.decorator';

/**
 * `JwtAuthGuard` + the permissions declared with `@RequirePermission`.
 *
 * Extends the JWT guard rather than assuming it ran first: a route annotated with only this guard
 * is still authenticated and still tenant-scoped. Forgetting `JwtAuthGuard` next to it is then
 * impossible rather than merely discouraged.
 *
 * A route that uses this guard without declaring a permission is treated as a wiring mistake and
 * refused. The alternative — letting it through — would make a typo in the decorator name silently
 * open the endpoint to every authenticated user.
 */
@Injectable()
export class PermissionGuard extends JwtAuthGuard {
  constructor(
    @Inject(TOKEN_SERVICE) tokens: TokenServicePort,
    tenantContext: TenantContextService,
    private readonly reflector: Reflector,
  ) {
    super(tokens, tenantContext);
  }

  canActivate(context: ExecutionContext): boolean {
    super.canActivate(context);

    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      throw new Error(
        'PermissionGuard usado em rota sem @RequirePermission — declare a permissão exigida.',
      );
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const granted = request.user?.permissions ?? [];

    const missing = required.filter((permission) => !grants(granted, permission));
    if (missing.length > 0) {
      // The message names the permission because the user is authenticated and this is actionable
      // information for whoever administers their account — not an enumeration oracle.
      throw new ForbiddenException(`Sem permissão para esta ação (${missing.join(', ')}).`);
    }

    return true;
  }
}
