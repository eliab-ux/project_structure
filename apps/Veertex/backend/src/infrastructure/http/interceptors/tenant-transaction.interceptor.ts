import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntityManager } from '@mikro-orm/core';
import { Observable, firstValueFrom, from } from 'rxjs';
import { ContactScopeService } from '../../security/contact-scope.service';
import { AuthenticatedRequest } from '../../security/guards/jwt-auth.guard';

export const SKIP_TENANT_TRANSACTION = 'skipTenantTransaction';

/**
 * Marks a route that must NOT open a transaction. The only legitimate use is a liveness probe:
 * `/health` answers "the process is up", and making it depend on a database round-trip would turn
 * a slow database into a restart loop.
 */
export const SkipTenantTransaction = () => SetMetadata(SKIP_TENANT_TRANSACTION, true);

/**
 * Runs every request inside a database transaction.
 *
 * This is the price of real RLS, and it is deliberate (approved with the F1 design): the tenant
 * reaches Postgres through a **transaction-local** `set_config`, because a session-level one leaks
 * across pooled connections. Transaction-local means no transaction, no scope — and with the
 * policies in place, no scope returns zero rows. So the transaction is not an optimisation detail,
 * it is what makes a scoped read possible at all.
 *
 * Registered globally (`APP_INTERCEPTOR`) rather than per controller, for the same reason the GUC
 * lives in a subscriber: a route someone forgets to annotate must be safe, not unscoped. Ordering
 * works out because Nest runs guards before interceptors — `JwtAuthGuard` has already established
 * the scope by the time the transaction opens and the subscriber reads it.
 */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(
    private readonly em: EntityManager,
    private readonly reflector: Reflector,
    private readonly contactScope: ContactScopeService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_TRANSACTION, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip || context.getType() !== 'http') {
      return next.handle();
    }

    // The handler's observable is consumed INSIDE the transaction, so the commit happens only after
    // the response value is produced — a handler that throws rolls the whole request back.
    //
    // `app.account_id` is set by TenantScopeSubscriber the moment the transaction opens (before this
    // callback runs). We then set `app.contact_scope` for the carteirização policy — per request,
    // never from a token claim (ADR-0007). Order matters: the account scope must be in place before
    // ContactScopeService reads the account's preference.
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return from(
      this.em.transactional(async (em) => {
        await this.contactScope.establishForRequest(em, request.user);
        return firstValueFrom(next.handle());
      }),
    );
  }
}
