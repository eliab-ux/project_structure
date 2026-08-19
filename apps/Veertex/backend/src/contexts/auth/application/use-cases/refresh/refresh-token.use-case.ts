import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ROLE_REPOSITORY,
  RoleRepositoryPort,
} from '../../../../role/application/ports/output/role-repository.port';
import { RoleId } from '../../../../role/domain/value-objects/role-id.vo';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import {
  GetEffectiveModulesQuery,
  GetEffectiveModulesUseCase,
} from '../../../../module/application/use-cases/get-effective-modules/get-effective-modules.use-case';
import { UnauthorizedTokenException } from '../../../domain/exceptions/invalid-token.exception';
import { RefreshResultDto } from '../../dto/auth-result.dto';
import { TENANT_SCOPE, TenantScopePort } from '../../ports/output/tenant-scope.port';
import { TOKEN_SERVICE, TokenServicePort } from '../../ports/output/token-service.port';

export class RefreshTokenCommand {
  constructor(public readonly refreshToken: string) {}
}

/**
 * Trades a refresh token for a fresh pair.
 *
 * Permissions are re-read from the database here rather than copied from the old token, and that is
 * what bounds the staleness the design accepts: a role edited five minutes ago takes effect at the
 * next refresh instead of at the next login.
 *
 * The user's and the account's current state are re-checked too — a disabled user or a suspended
 * account must not be able to keep a session alive indefinitely by refreshing.
 */
@Injectable()
export class RefreshTokenUseCase implements UseCase<RefreshTokenCommand, RefreshResultDto> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    @Inject(TENANT_SCOPE) private readonly tenantScope: TenantScopePort,
    private readonly getEffectiveModules: GetEffectiveModulesUseCase,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshResultDto> {
    // Throws UnauthorizedTokenException when absent, malformed, expired or an access token.
    const payload = this.tokens.verifyRefreshToken(command.refreshToken);

    // The token is signed by us, so its accountId is trustworthy — this is not a client-supplied
    // scope, it is one we issued and just verified.
    await this.tenantScope.establishFromAuthenticatedUser(payload.accountId);

    const user = await this.users.findById(UserId.from(payload.sub));
    if (!user || !user.isActive) {
      throw new UnauthorizedTokenException();
    }

    const account = await this.accounts.findById(AccountId.from(payload.accountId));
    if (!account || !account.isActive) {
      throw new UnauthorizedTokenException();
    }

    const role = await this.roles.findById(RoleId.from(user.roleId));
    const permissions = role ? [...role.permissions.values] : [];

    // Relidos do banco, como as permissões — é justamente isto que limita a defasagem da Opção A:
    // um módulo ligado ou desligado agora vale no próximo refresh, e não só no próximo login.
    const modules = await this.getEffectiveModules.execute(
      new GetEffectiveModulesQuery(payload.accountId),
    );

    return this.tokens.issueForUser({
      sub: user.id.value,
      accountId: payload.accountId,
      roleId: user.roleId,
      permissions,
      modules,
    });
  }
}
