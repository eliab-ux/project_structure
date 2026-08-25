import { AccountRepositoryPort } from '../../../src/contexts/account/application/ports/output/account-repository.port';
import { Account } from '../../../src/contexts/account/domain/entities/account.entity';
import { AccountPlan } from '../../../src/contexts/account/domain/value-objects/account-plan.vo';
import { AccountStatus } from '../../../src/contexts/account/domain/value-objects/account-status.vo';
import { Document } from '../../../src/contexts/account/domain/value-objects/document.vo';
import { UserRepositoryPort } from '../../../src/contexts/user/application/ports/output/user-repository.port';
import { User } from '../../../src/contexts/user/domain/entities/user.entity';
import { Email } from '../../../src/contexts/user/domain/value-objects/email.vo';
import { UserRole } from '../../../src/contexts/user/domain/value-objects/user-role.vo';
import { InvalidCredentialsException } from '../../../src/contexts/user/domain/exceptions/invalid-credentials.exception';
import { PasswordHasherPort } from '../../../src/contexts/auth/application/ports/output/password-hasher.port';
import { TokenServicePort } from '../../../src/contexts/auth/application/ports/output/token-service.port';
import { LoginUseCase } from '../../../src/contexts/auth/application/use-cases/login/login.use-case';
import { LoginCommand } from '../../../src/contexts/auth/application/use-cases/login/login.command';
import { AuditAction } from '../../../src/contexts/audit/domain/value-objects/audit-action.vo';
import { RecordAuditLogUseCase } from '../../../src/contexts/audit/application/use-cases/record-audit-log.use-case';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';

function makeAccount(status: AccountStatus, reason: string | null = null): Account {
  const account = Account.create({
    name: 'Gabinete Exemplo',
    document: Document.create('11144477735'),
    plan: AccountPlan.STANDARD,
    dailySendCeiling: 500,
    timezone: 'America/Sao_Paulo',
  });
  if (status === AccountStatus.SUSPENDED) {
    account.suspend(reason ?? 'motivo qualquer', 'admin-1');
    account.pullDomainEvents();
  }
  return account;
}

function makeUser(overrides: { active?: boolean } = {}): User {
  const user = User.create({
    accountId: ACCOUNT_ID,
    name: 'Maria Operadora',
    email: Email.create('maria@exemplo.com'),
    phone: PhoneE164.create('+5511988887777'),
    passwordHash: 'hashed',
    role: UserRole.OPERATOR,
  });
  if (overrides.active === false) {
    user.disable();
  }
  return user;
}

describe('LoginUseCase', () => {
  let users: jest.Mocked<UserRepositoryPort>;
  let accounts: jest.Mocked<AccountRepositoryPort>;
  let hasher: jest.Mocked<PasswordHasherPort>;
  let tokens: jest.Mocked<TokenServicePort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let useCase: LoginUseCase;

  beforeEach(() => {
    users = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      listByAccount: jest.fn(),
      save: jest.fn(async (user) => user),
      findByEmailForAuthentication: jest.fn(),
    } as unknown as jest.Mocked<UserRepositoryPort>;

    accounts = {
      findById: jest.fn(),
      existsByDocument: jest.fn(),
      save: jest.fn(),
      listForPlatform: jest.fn(),
    } as unknown as jest.Mocked<AccountRepositoryPort>;

    hasher = { hash: jest.fn(), compare: jest.fn() } as unknown as jest.Mocked<PasswordHasherPort>;

    tokens = {
      issueForUser: jest.fn(() => ({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 900,
      })),
      issueForPlatformAdmin: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyPlatformAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      verifyPlatformRefreshToken: jest.fn(),
    } as unknown as jest.Mocked<TokenServicePort>;

    audit = { execute: jest.fn() };

    useCase = new LoginUseCase(
      users,
      accounts,
      hasher,
      tokens,
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  it('authenticates and returns tokens plus user and account', async () => {
    users.findByEmailForAuthentication.mockResolvedValue(makeUser());
    accounts.findById.mockResolvedValue(makeAccount(AccountStatus.ACTIVE));
    hasher.compare.mockResolvedValue(true);

    const result = await useCase.execute(
      new LoginCommand('maria@exemplo.com', 'senha-forte-123', '10.0.0.1'),
    );

    expect(result.accessToken).toBe('access');
    expect(result.user.email).toBe('maria@exemplo.com');
    // The response DTO cannot carry the hash — it is not on UserDto at all.
    expect(Object.keys(result.user)).not.toContain('passwordHash');
    expect(users.save).toHaveBeenCalledTimes(1);
  });

  it('records a successful login in the audit trail', async () => {
    users.findByEmailForAuthentication.mockResolvedValue(makeUser());
    accounts.findById.mockResolvedValue(makeAccount(AccountStatus.ACTIVE));
    hasher.compare.mockResolvedValue(true);

    await useCase.execute(new LoginCommand('maria@exemplo.com', 'senha', '10.0.0.1'));

    expect(audit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.USER_LOGIN, ip: '10.0.0.1' }),
    );
  });

  it('LETS A SUSPENDED ACCOUNT LOG IN, exposing the reason', async () => {
    // §5, FASE 1 item 6: login keeps working precisely so the user can read why nothing sends.
    users.findByEmailForAuthentication.mockResolvedValue(makeUser());
    accounts.findById.mockResolvedValue(
      makeAccount(AccountStatus.SUSPENDED, 'Taxa de opt-out fora do padrão'),
    );
    hasher.compare.mockResolvedValue(true);

    const result = await useCase.execute(new LoginCommand('maria@exemplo.com', 'senha', null));

    expect(result.accessToken).toBe('access');
    expect(result.account.status).toBe(AccountStatus.SUSPENDED);
    expect(result.account.suspensionReason).toBe('Taxa de opt-out fora do padrão');
  });

  it('rejects an unknown e-mail with the same error as a wrong password', async () => {
    users.findByEmailForAuthentication.mockResolvedValue(null);

    await expect(
      useCase.execute(new LoginCommand('naoexiste@exemplo.com', 'senha', null)),
    ).rejects.toThrow(InvalidCredentialsException);
    expect(audit.execute).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.USER_LOGIN_FAILED }),
    );
  });

  it('rejects a wrong password', async () => {
    users.findByEmailForAuthentication.mockResolvedValue(makeUser());
    hasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute(new LoginCommand('maria@exemplo.com', 'errada', null)),
    ).rejects.toThrow(InvalidCredentialsException);
    expect(tokens.issueForUser).not.toHaveBeenCalled();
  });

  it('rejects a disabled user with the SAME message as a wrong password', async () => {
    users.findByEmailForAuthentication.mockResolvedValue(makeUser({ active: false }));
    hasher.compare.mockResolvedValue(true);

    // A distinct message would tell an attacker the e-mail exists.
    await expect(
      useCase.execute(new LoginCommand('maria@exemplo.com', 'senha', null)),
    ).rejects.toThrow(InvalidCredentialsException);
  });

  it('never puts the password or the hash in the audit payload', async () => {
    users.findByEmailForAuthentication.mockResolvedValue(makeUser());
    hasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute(new LoginCommand('maria@exemplo.com', 'senha-secreta', null)),
    ).rejects.toThrow(InvalidCredentialsException);

    const payloads = JSON.stringify(audit.execute.mock.calls);
    expect(payloads).not.toContain('senha-secreta');
    expect(payloads).not.toContain('hashed');
  });

  it('scopes the token to the accountId of the authenticated user', async () => {
    users.findByEmailForAuthentication.mockResolvedValue(makeUser());
    accounts.findById.mockResolvedValue(makeAccount(AccountStatus.ACTIVE));
    hasher.compare.mockResolvedValue(true);

    await useCase.execute(new LoginCommand('maria@exemplo.com', 'senha', null));

    expect(tokens.issueForUser).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: ACCOUNT_ID, role: UserRole.OPERATOR }),
    );
  });
});
