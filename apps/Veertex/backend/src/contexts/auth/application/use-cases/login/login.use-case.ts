import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { Email } from '../../../../../shared/domain/value-objects/email.vo';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { AccountUnavailableException } from '../../../../account/domain/exceptions/account-unavailable.exception';
import {
  ROLE_REPOSITORY,
  RoleRepositoryPort,
} from '../../../../role/application/ports/output/role-repository.port';
import { RoleId } from '../../../../role/domain/value-objects/role-id.vo';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { InvalidCredentialsException } from '../../../../user/domain/exceptions/user-exceptions';
import { UserDto } from '../../../../user/application/dto/user.dto';
import { AuthResultDto } from '../../dto/auth-result.dto';
import { PASSWORD_HASHER, PasswordHasherPort } from '../../ports/output/password-hasher.port';
import { TENANT_SCOPE, TenantScopePort } from '../../ports/output/tenant-scope.port';
import { TOKEN_SERVICE, TokenServicePort } from '../../ports/output/token-service.port';

export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly ip: string | null,
  ) {}
}

/**
 * E-mail + password. The only place in the system where a tenant is determined by something other
 * than a token.
 *
 * The order of operations is the security design, not a style choice:
 *
 *  1. the cross-tenant lookup finds the user by e-mail (a `security definer` function — the single
 *     authorised way past RLS without a scope);
 *  2. the scope is established immediately from THAT row's accountId, so everything after it is
 *     tenant-scoped like any other request;
 *  3. only then are the password, the user's status and the account's status checked.
 *
 * Every failure — unknown e-mail, wrong password — raises the SAME exception with the SAME message.
 * Two different messages would tell an attacker which addresses are registered.
 *
 * The password comparison runs even when no user was found (against a dummy hash) so that a
 * registered e-mail and an unknown one take the same time. Without it, response latency alone
 * enumerates accounts.
 */
@Injectable()
export class LoginUseCase implements UseCase<LoginCommand, AuthResultDto> {
  private readonly logger = new Logger(LoginUseCase.name);

  /**
   * A real bcrypt hash of a value nobody knows, compared against when the e-mail does not exist.
   * Its only job is to burn the same ~250ms the real path burns.
   */
  private static readonly DUMMY_HASH =
    '$2a$12$C6UzMDM.H6dfI/f/IKcEe.7Zzq6QwQdQ0IYyO8FnH1zvKX0lJcPqK';

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    @Inject(TENANT_SCOPE) private readonly tenantScope: TenantScopePort,
  ) {}

  async execute(command: LoginCommand): Promise<AuthResultDto> {
    const email = Email.create(command.email);
    const found = await this.users.findForAuthentication(email);

    if (!found) {
      // Same work, same time, same exception as a wrong password.
      await this.hasher.compare(command.password, LoginUseCase.DUMMY_HASH);
      this.logger.warn('Falha na autenticação', { reason: 'unknown_email', ip: command.ip });
      throw new InvalidCredentialsException();
    }

    // From here on the request is scoped exactly as if a JWT had carried this account.
    await this.tenantScope.establishFromAuthenticatedUser(found.accountId);

    const { user } = found;
    const matches = await this.hasher.compare(command.password, user.passwordHashForPersistence());
    if (!matches) {
      this.logger.warn('Falha na autenticação', {
        reason: 'invalid_password',
        userId: user.id.value,
        ip: command.ip,
      });
      throw new InvalidCredentialsException();
    }

    // After the password, never before: a disabled account must not be discoverable by someone who
    // does not know the password.
    user.assertCanAuthenticate();

    const account = await this.accounts.findById(AccountId.from(found.accountId));
    if (!account) {
      throw new AccountUnavailableException();
    }
    account.assertUsable();

    const role = await this.roles.findById(RoleId.from(user.roleId));
    const permissions = role ? [...role.permissions.values] : [];

    user.registerSuccessfulLogin();
    await this.users.save(user);

    const issued = this.tokens.issueForUser({
      sub: user.id.value,
      accountId: found.accountId,
      roleId: user.roleId,
      permissions,
    });

    this.logger.log('Usuário autenticado', { userId: user.id.value, accountId: found.accountId });

    return {
      ...issued,
      user: UserDto.fromDomain(user),
      accountId: found.accountId,
      permissions,
    };
  }
}
