import { PasswordHasherPort } from '../../../src/contexts/auth/application/ports/output/password-hasher.port';
import { PasswordResetCodeRepositoryPort } from '../../../src/contexts/auth/application/ports/output/password-reset-code-repository.port';
import { ResetCodeMessengerPort } from '../../../src/contexts/auth/application/ports/output/reset-code-messenger.port';
import { RequestPasswordResetUseCase } from '../../../src/contexts/auth/application/use-cases/request-password-reset/request-password-reset.use-case';
import { RequestPasswordResetCommand } from '../../../src/contexts/auth/application/use-cases/request-password-reset/request-password-reset.command';
import { ResetPasswordUseCase } from '../../../src/contexts/auth/application/use-cases/reset-password/reset-password.use-case';
import { ResetPasswordCommand } from '../../../src/contexts/auth/application/use-cases/reset-password/reset-password.command';
import {
  PasswordResetCode,
  RESET_CODE_MAX_ATTEMPTS,
  RESET_CODE_TTL_MINUTES,
} from '../../../src/contexts/auth/domain/entities/password-reset-code.entity';
import { InvalidResetCodeException } from '../../../src/contexts/auth/domain/exceptions/invalid-reset-code.exception';
import { RecoveryChannelUnavailableException } from '../../../src/contexts/auth/domain/exceptions/recovery-channel-unavailable.exception';
import { WeakPasswordException } from '../../../src/contexts/auth/domain/exceptions/weak-password.exception';
import { assertStrongPassword } from '../../../src/contexts/auth/domain/password-policy';
import { RecordAuditLogUseCase } from '../../../src/contexts/audit/application/use-cases/record-audit-log.use-case';
import { AuditAction } from '../../../src/contexts/audit/domain/value-objects/audit-action.vo';
import { UserRepositoryPort } from '../../../src/contexts/user/application/ports/output/user-repository.port';
import { User } from '../../../src/contexts/user/domain/entities/user.entity';
import { Email } from '../../../src/contexts/user/domain/value-objects/email.vo';
import { UserId } from '../../../src/contexts/user/domain/value-objects/user-id.vo';
import { UserRole } from '../../../src/contexts/user/domain/value-objects/user-role.vo';
import { UserStatus } from '../../../src/contexts/user/domain/value-objects/user-status.vo';
import { PhoneE164 } from '../../../src/shared/domain/value-objects/phone-e164.vo';

const ACCOUNT_A = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const EMAIL = 'maria@exemplo.com';
const PHONE = '+5511988887777';
const CODE = '123456';

function makeUser(overrides: { phone?: PhoneE164 | null; status?: UserStatus } = {}): User {
  return User.reconstitute({
    id: UserId.from(USER_ID),
    accountId: ACCOUNT_A,
    name: 'Maria Aparecida',
    email: Email.create(EMAIL),
    phone: overrides.phone === undefined ? PhoneE164.create(PHONE) : overrides.phone,
    passwordHash: 'old-hash',
    role: UserRole.OPERATOR,
    status: overrides.status ?? UserStatus.ACTIVE,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  });
}

function makeCode(overrides: Partial<{ attempts: number; expiresAt: Date }> = {}) {
  return PasswordResetCode.reconstitute({
    id: 'code-1',
    accountId: ACCOUNT_A,
    userId: USER_ID,
    codeHash: 'bcrypt-hash-do-codigo',
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60_000),
    usedAt: null,
    sentAt: new Date(),
    attempts: overrides.attempts ?? 0,
    createdAt: new Date(),
  });
}

describe('password policy', () => {
  it('requires at least 10 characters with letters and digits', () => {
    expect(() => assertStrongPassword('senha-forte-123')).not.toThrow();
    expect(() => assertStrongPassword('curta1')).toThrow(WeakPasswordException);
    expect(() => assertStrongPassword('somenteletrasaqui')).toThrow(WeakPasswordException);
    expect(() => assertStrongPassword('1234567890')).toThrow(WeakPasswordException);
    expect(() => assertStrongPassword('')).toThrow(WeakPasswordException);
  });

  it('caps at 72 bytes, where bcrypt stops reading', () => {
    // Accepting more would silently ignore the tail and mislead the user about their password.
    expect(() => assertStrongPassword(`${'a'.repeat(70)}12`)).not.toThrow();
    expect(() => assertStrongPassword(`${'a'.repeat(80)}12`)).toThrow(WeakPasswordException);
  });
});

describe('PasswordResetCode', () => {
  it('is unusable once the attempts run out, even before expiring', () => {
    const code = makeCode({ attempts: RESET_CODE_MAX_ATTEMPTS });

    expect(code.isExpired()).toBe(false);
    expect(code.isUsable()).toBe(false);
  });

  it('is unusable after expiry, even with attempts left', () => {
    const code = makeCode({ expiresAt: new Date(Date.now() - 1_000) });

    expect(code.hasAttemptsLeft).toBe(true);
    expect(code.isUsable()).toBe(false);
  });

  it('lives for exactly the advertised TTL', () => {
    const now = new Date('2026-08-05T12:00:00Z');
    const code = PasswordResetCode.issue({
      accountId: ACCOUNT_A,
      userId: USER_ID,
      codeHash: 'h',
      now,
    });

    // The message tells the user "vale por N minutos"; if the entity disagreed, the code would die
    // before the sentence the user read.
    expect(code.expiresAt.getTime() - now.getTime()).toBe(RESET_CODE_TTL_MINUTES * 60_000);
  });

  it('starts with sentAt null — a code that never left must not burn the hourly quota', () => {
    const code = PasswordResetCode.issue({ accountId: ACCOUNT_A, userId: USER_ID, codeHash: 'h' });

    expect(code.sentAt).toBeNull();
    code.markSent();
    expect(code.sentAt).not.toBeNull();
  });
});

describe('RequestPasswordResetUseCase', () => {
  let users: jest.Mocked<UserRepositoryPort>;
  let codes: jest.Mocked<PasswordResetCodeRepositoryPort>;
  let hasher: jest.Mocked<PasswordHasherPort>;
  let messenger: jest.Mocked<ResetCodeMessengerPort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let useCase: RequestPasswordResetUseCase;

  beforeEach(() => {
    users = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      listByAccount: jest.fn(),
      save: jest.fn(async (user) => user),
      findByEmailForAuthentication: jest.fn(async () => makeUser()),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    codes = {
      save: jest.fn(async (code) => code),
      findLatestUnused: jest.fn(),
      countSentSince: jest.fn(async () => 0),
      invalidateAllForUser: jest.fn(),
    } as unknown as jest.Mocked<PasswordResetCodeRepositoryPort>;
    hasher = {
      hash: jest.fn(async () => 'bcrypt-hash-do-codigo'),
      compare: jest.fn(),
    } as unknown as jest.Mocked<PasswordHasherPort>;
    messenger = {
      ensureAvailable: jest.fn(),
      sendResetCode: jest.fn(),
    } as unknown as jest.Mocked<ResetCodeMessengerPort>;
    audit = { execute: jest.fn() };

    useCase = new RequestPasswordResetUseCase(
      users,
      codes,
      hasher,
      messenger,
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  it('sends a six-digit code to the user WhatsApp', async () => {
    await useCase.execute(new RequestPasswordResetCommand(EMAIL, '10.0.0.1'));

    expect(messenger.sendResetCode).toHaveBeenCalledTimes(1);
    const sent = messenger.sendResetCode.mock.calls[0][0];
    expect(sent.phoneE164).toBe(PHONE);
    expect(sent.code).toMatch(/^\d{6}$/);
    expect(sent.expiresInMinutes).toBe(RESET_CODE_TTL_MINUTES);
    // First name only: the message greets, it does not identify.
    expect(sent.name).toBe('Maria');
  });

  it('never stores the code in the clear — only its hash reaches the repository', async () => {
    await useCase.execute(new RequestPasswordResetCommand(EMAIL, null));

    const plaintext = messenger.sendResetCode.mock.calls[0][0].code;
    expect(hasher.hash).toHaveBeenCalledWith(plaintext);
    const persisted = codes.save.mock.calls.map(([code]) => code.codeHash);
    expect(persisted).not.toContain(plaintext);
    expect(persisted.every((hash) => hash === 'bcrypt-hash-do-codigo')).toBe(true);
  });

  it('checks the channel BEFORE looking the user up', async () => {
    // If the order were reversed, a real e-mail would error while an unknown one answered 204 —
    // handing an attacker the list of accounts that exist.
    messenger.ensureAvailable.mockImplementation(() => {
      throw new RecoveryChannelUnavailableException();
    });

    await expect(useCase.execute(new RequestPasswordResetCommand(EMAIL, null))).rejects.toThrow(
      RecoveryChannelUnavailableException,
    );
    expect(users.findByEmailForAuthentication).not.toHaveBeenCalled();
  });

  it('resolves silently for an unknown e-mail — no exception, no send', async () => {
    users.findByEmailForAuthentication.mockResolvedValue(null);

    await expect(
      useCase.execute(new RequestPasswordResetCommand('ninguem@exemplo.com', null)),
    ).resolves.toBeUndefined();
    expect(messenger.sendResetCode).not.toHaveBeenCalled();
    expect(codes.save).not.toHaveBeenCalled();
  });

  it('resolves silently for a disabled user', async () => {
    users.findByEmailForAuthentication.mockResolvedValue(makeUser({ status: UserStatus.DISABLED }));

    await expect(
      useCase.execute(new RequestPasswordResetCommand(EMAIL, null)),
    ).resolves.toBeUndefined();
    expect(messenger.sendResetCode).not.toHaveBeenCalled();
  });

  it('resolves silently when the user has no WhatsApp on file', async () => {
    users.findByEmailForAuthentication.mockResolvedValue(makeUser({ phone: null }));

    await expect(
      useCase.execute(new RequestPasswordResetCommand(EMAIL, null)),
    ).resolves.toBeUndefined();
    expect(messenger.sendResetCode).not.toHaveBeenCalled();
  });

  it('stops at three sends in the last hour', async () => {
    codes.countSentSince.mockResolvedValue(3);

    await useCase.execute(new RequestPasswordResetCommand(EMAIL, null));

    expect(messenger.sendResetCode).not.toHaveBeenCalled();
    // And the window is one hour back from now, not a calendar hour.
    const since = codes.countSentSince.mock.calls[0][1];
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(59 * 60_000);
  });

  it('invalidates any previous live code before issuing a new one', async () => {
    await useCase.execute(new RequestPasswordResetCommand(EMAIL, null));

    // Two live codes would double the guessing surface.
    expect(codes.invalidateAllForUser).toHaveBeenCalledWith(USER_ID, expect.any(Date));
  });

  it('marks sentAt only AFTER the message goes out', async () => {
    // The value has to be recorded AT call time: `save` returns the same aggregate instance, so
    // inspecting `mock.calls[0][0]` afterwards would read the object already mutated by markSent().
    const sentAtPerSave: (Date | null)[] = [];
    codes.save.mockImplementation(async (code) => {
      sentAtPerSave.push(code.sentAt);
      return code;
    });

    await useCase.execute(new RequestPasswordResetCommand(EMAIL, null));

    // Two saves: the issue (sentAt null) and the confirmation (sentAt set).
    expect(sentAtPerSave).toHaveLength(2);
    expect(sentAtPerSave[0]).toBeNull();
    expect(sentAtPerSave[1]).not.toBeNull();
  });

  it('resolves — does not throw — when the send fails, and burns no quota', async () => {
    messenger.sendResetCode.mockRejectedValue(new Error('Evolution fora do ar'));

    // Letting the failure surface would mean a registered e-mail answers 500 while an unknown one
    // answers 204: the enumeration oracle, reintroduced through the error path.
    await expect(
      useCase.execute(new RequestPasswordResetCommand(EMAIL, null)),
    ).resolves.toBeUndefined();

    // Persisted once, with sentAt null: the user's next attempt in the same hour is not blocked by
    // a message nobody received.
    expect(codes.save).toHaveBeenCalledTimes(1);
    expect(codes.save.mock.calls[0][0].sentAt).toBeNull();
    // And nothing is audited as "requested" — no message went out.
    expect(audit.execute).not.toHaveBeenCalled();
  });

  it('audits the request with neither the code nor the phone number', async () => {
    await useCase.execute(new RequestPasswordResetCommand(EMAIL, '10.0.0.1'));

    expect(audit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.PASSWORD_RESET_REQUESTED,
        accountId: ACCOUNT_A,
      }),
    );
    const recorded = JSON.stringify(audit.execute.mock.calls);
    expect(recorded).not.toContain(messenger.sendResetCode.mock.calls[0][0].code);
    expect(recorded).not.toContain(PHONE);
    expect(recorded).not.toContain('88887777');
  });
});

describe('ResetPasswordUseCase', () => {
  let users: jest.Mocked<UserRepositoryPort>;
  let codes: jest.Mocked<PasswordResetCodeRepositoryPort>;
  let hasher: jest.Mocked<PasswordHasherPort>;
  let audit: jest.Mocked<Pick<RecordAuditLogUseCase, 'execute'>>;
  let useCase: ResetPasswordUseCase;

  beforeEach(() => {
    users = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      listByAccount: jest.fn(),
      save: jest.fn(async (user) => user),
      findByEmailForAuthentication: jest.fn(async () => makeUser()),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    codes = {
      save: jest.fn(async (code) => code),
      findLatestUnused: jest.fn(async () => makeCode()),
      countSentSince: jest.fn(),
      invalidateAllForUser: jest.fn(),
    } as unknown as jest.Mocked<PasswordResetCodeRepositoryPort>;
    hasher = {
      hash: jest.fn(async () => 'new-hash'),
      compare: jest.fn(async () => true),
    } as unknown as jest.Mocked<PasswordHasherPort>;
    audit = { execute: jest.fn() };

    useCase = new ResetPasswordUseCase(
      users,
      codes,
      hasher,
      audit as unknown as RecordAuditLogUseCase,
    );
  });

  it('compares the typed code against the stored HASH, never a stored plaintext', async () => {
    await useCase.execute(new ResetPasswordCommand(EMAIL, CODE, 'senha-nova-123', '10.0.0.1'));

    expect(hasher.compare).toHaveBeenCalledWith(CODE, 'bcrypt-hash-do-codigo');
  });

  it('burns the code and every other live one for that user', async () => {
    await useCase.execute(new ResetPasswordCommand(EMAIL, CODE, 'senha-nova-123', null));

    expect(codes.save.mock.calls[0][0].usedAt).not.toBeNull();
    expect(codes.invalidateAllForUser).toHaveBeenCalledTimes(1);
    expect(users.save).toHaveBeenCalledTimes(1);
  });

  it('counts a wrong guess BEFORE refusing — otherwise the code accepts guesses forever', async () => {
    hasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute(new ResetPasswordCommand(EMAIL, '000000', 'senha-nova-123', null)),
    ).rejects.toThrow(InvalidResetCodeException);

    expect(codes.save).toHaveBeenCalledTimes(1);
    expect(codes.save.mock.calls[0][0].attempts).toBe(1);
    expect(users.save).not.toHaveBeenCalled();
  });

  it('refuses a code whose attempts are exhausted, without another bcrypt compare', async () => {
    codes.findLatestUnused.mockResolvedValue(makeCode({ attempts: RESET_CODE_MAX_ATTEMPTS }));

    await expect(
      useCase.execute(new ResetPasswordCommand(EMAIL, CODE, 'senha-nova-123', null)),
    ).rejects.toThrow(InvalidResetCodeException);
    expect(hasher.compare).not.toHaveBeenCalled();
  });

  it('refuses an expired code', async () => {
    codes.findLatestUnused.mockResolvedValue(makeCode({ expiresAt: new Date(Date.now() - 1_000) }));

    await expect(
      useCase.execute(new ResetPasswordCommand(EMAIL, CODE, 'senha-nova-123', null)),
    ).rejects.toThrow(InvalidResetCodeException);
  });

  it('raises the SAME exception for unknown e-mail, missing code and wrong code', async () => {
    const expected = InvalidResetCodeException;

    users.findByEmailForAuthentication.mockResolvedValue(null);
    await expect(
      useCase.execute(
        new ResetPasswordCommand('ninguem@exemplo.com', CODE, 'senha-nova-123', null),
      ),
    ).rejects.toThrow(expected);

    users.findByEmailForAuthentication.mockResolvedValue(makeUser());
    codes.findLatestUnused.mockResolvedValue(null);
    await expect(
      useCase.execute(new ResetPasswordCommand(EMAIL, CODE, 'senha-nova-123', null)),
    ).rejects.toThrow(expected);

    codes.findLatestUnused.mockResolvedValue(makeCode());
    hasher.compare.mockResolvedValue(false);
    await expect(
      useCase.execute(new ResetPasswordCommand(EMAIL, CODE, 'senha-nova-123', null)),
    ).rejects.toThrow(expected);
  });

  it('refuses to reset the password of a disabled user', async () => {
    users.findByEmailForAuthentication.mockResolvedValue(makeUser({ status: UserStatus.DISABLED }));

    await expect(
      useCase.execute(new ResetPasswordCommand(EMAIL, CODE, 'senha-nova-123', null)),
    ).rejects.toThrow(InvalidResetCodeException);
  });

  it('enforces the password policy BEFORE touching the code', async () => {
    await expect(
      useCase.execute(new ResetPasswordCommand(EMAIL, CODE, 'fraca', null)),
    ).rejects.toThrow(WeakPasswordException);

    // A weak password must not consume an attempt of a perfectly good code.
    expect(codes.findLatestUnused).not.toHaveBeenCalled();
    expect(codes.save).not.toHaveBeenCalled();
  });

  it('audits with the accountId stored WITH the code, never one from the request', async () => {
    await useCase.execute(new ResetPasswordCommand(EMAIL, CODE, 'senha-nova-123', '10.0.0.1'));

    expect(audit.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.PASSWORD_RESET_COMPLETED,
        accountId: ACCOUNT_A,
      }),
    );
    const recorded = JSON.stringify(audit.execute.mock.calls);
    expect(recorded).not.toContain(CODE);
    expect(recorded).not.toContain('senha-nova-123');
  });
});
