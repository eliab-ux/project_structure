import { Inject, Injectable, Logger } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  ACCOUNT_REPOSITORY,
  AccountRepositoryPort,
} from '../../../../account/application/ports/output/account-repository.port';
import { AccountDto } from '../../../../account/application/dto/account.dto';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { AccountNotFoundException } from '../../../../account/domain/exceptions/account-not-found.exception';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { UserDto } from '../../../../user/application/dto/user.dto';
import { Email } from '../../../../user/domain/value-objects/email.vo';
import { InvalidCredentialsException } from '../../../../user/domain/exceptions/invalid-credentials.exception';
import {
  AuditAction,
  AuditActorType,
} from '../../../../audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../../audit/application/use-cases/record-audit-log.use-case';
import { PASSWORD_HASHER, PasswordHasherPort } from '../../ports/output/password-hasher.port';
import { TOKEN_SERVICE, TokenServicePort } from '../../ports/output/token-service.port';
import { AuthResultDto } from '../../dto/auth-result.dto';
import { LoginCommand } from './login.command';

/**
 * Tenant login: e-mail + password.
 *
 * Two decisions worth naming:
 *  - a suspended account STILL logs in, because the user has to be able to read why (§5 item 6);
 *  - every failure path raises the same InvalidCredentialsException, so the response cannot be
 *    used to enumerate which e-mails exist.
 */
@Injectable()
export class LoginUseCase implements UseCase<LoginCommand, AuthResultDto> {
  private readonly logger = new Logger(LoginUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    private readonly audit: RecordAuditLogUseCase,
  ) {}

  async execute(command: LoginCommand): Promise<AuthResultDto> {
    const email = Email.create(command.email);

    // The only unscoped user read in the system: there is no tenant before authentication.
    const user = await this.users.findByEmailForAuthentication(email);

    if (!user) {
      await this.recordFailure(null, null, command.ip, 'unknown_email');
      throw new InvalidCredentialsException();
    }

    const passwordMatches = await this.hasher.compare(
      command.password,
      user.passwordHashForPersistence(),
    );

    if (!passwordMatches) {
      await this.recordFailure(user.accountId, user.id.value, command.ip, 'invalid_password');
      throw new InvalidCredentialsException();
    }

    // A disabled user is not a wrong password — but the client is told the same thing.
    if (!user.isActive) {
      await this.recordFailure(user.accountId, user.id.value, command.ip, 'user_disabled');
      throw new InvalidCredentialsException();
    }

    const account = await this.accounts.findById(AccountId.from(user.accountId));
    if (!account) {
      // A user without an account is a data-integrity failure, not a credentials problem.
      this.logger.error('Usuário autenticado sem conta correspondente', {
        userId: user.id.value,
        accountId: user.accountId,
      });
      throw new AccountNotFoundException();
    }

    user.registerSuccessfulLogin();
    await this.users.save(user);

    const issued = this.tokens.issueForUser({
      sub: user.id.value,
      accountId: user.accountId,
      role: user.role,
    });

    await this.audit.execute({
      accountId: user.accountId,
      actorType: AuditActorType.USER,
      actorId: user.id.value,
      action: AuditAction.USER_LOGIN,
      entityType: 'user',
      entityId: user.id.value,
      ip: command.ip,
      payload: { accountStatus: account.status },
    });

    this.logger.log('Usuário autenticado', { userId: user.id.value, accountId: user.accountId });

    const result = new AuthResultDto();
    result.accessToken = issued.accessToken;
    result.refreshToken = issued.refreshToken;
    result.expiresIn = issued.expiresIn;
    result.user = UserDto.fromDomain(user);
    result.account = AccountDto.fromDomain(account);
    return result;
  }

  private async recordFailure(
    accountId: string | null,
    userId: string | null,
    ip: string | null,
    reason: string,
  ): Promise<void> {
    // Reason is logged for support, never returned to the client. No password, ever.
    this.logger.warn('Falha na autenticação', { userId, reason });
    await this.audit.execute({
      accountId,
      actorType: AuditActorType.USER,
      actorId: userId,
      action: AuditAction.USER_LOGIN_FAILED,
      entityType: 'user',
      entityId: userId,
      ip,
      payload: { reason },
    });
  }
}
