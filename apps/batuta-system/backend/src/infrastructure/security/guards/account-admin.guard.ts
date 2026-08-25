import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtAuthGuard, AuthenticatedRequest } from './jwt-auth.guard';

/**
 * JwtAuthGuard + role ACCOUNT_ADMIN. Extends the JWT guard rather than assuming it ran first: a
 * route annotated with only this guard is still authenticated and still tenant-scoped.
 *
 * The role is read from the token, which is re-issued from the database on every refresh — so a
 * demoted user loses admin within one access-token lifetime, not at their next login.
 */
@Injectable()
export class AccountAdminGuard extends JwtAuthGuard {
  canActivate(context: ExecutionContext): boolean {
    super.canActivate(context);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.role !== 'ACCOUNT_ADMIN') {
      throw new ForbiddenException('Ação restrita ao administrador da conta.');
    }
    return true;
  }
}
