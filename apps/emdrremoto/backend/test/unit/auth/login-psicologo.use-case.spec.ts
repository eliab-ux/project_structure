import {
  LoginPsicologoCommand,
  LoginPsicologoUseCase,
} from '../../../src/contexts/auth/application/use-cases/login-psicologo/login-psicologo.use-case';
import { Psicologo } from '../../../src/contexts/psicologo/domain/entities/psicologo.entity';
import { Email } from '../../../src/contexts/psicologo/domain/value-objects/email.vo';
import { PsicologoRepositoryPort } from '../../../src/contexts/psicologo/application/ports/output/psicologo-repository.port';
import { PasswordHasherPort } from '../../../src/infrastructure/security/ports/password-hasher.port';
import { TokenServicePort } from '../../../src/infrastructure/security/ports/token-service.port';
import {
  EmailNotVerifiedException,
  InvalidCredentialsException,
} from '../../../src/contexts/auth/domain/exceptions/auth.exceptions';

function buildPsicologo(verified: boolean): Psicologo {
  const p = Psicologo.register(Email.create('ana@example.com'), 'Ana Souza', '11999998888', 'HASH');
  if (verified) {
    p.verifyEmail();
  }
  return p;
}

describe('LoginPsicologoUseCase', () => {
  let repo: jest.Mocked<PsicologoRepositoryPort>;
  let hasher: jest.Mocked<PasswordHasherPort>;
  let tokens: jest.Mocked<TokenServicePort>;
  let useCase: LoginPsicologoUseCase;

  beforeEach(() => {
    repo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByRecoveryCode: jest.fn(),
    };
    hasher = { hash: jest.fn(), compare: jest.fn() };
    tokens = {
      signAccessToken: jest.fn().mockResolvedValue('access'),
      signRefreshToken: jest.fn().mockResolvedValue('refresh'),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };
    useCase = new LoginPsicologoUseCase(repo, hasher, tokens);
  });

  it('throws InvalidCredentials when the email does not exist', async () => {
    repo.findByEmail.mockResolvedValue(null);
    await expect(
      useCase.execute(new LoginPsicologoCommand('ana@example.com', 'secret')),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
  });

  it('throws InvalidCredentials when the password does not match', async () => {
    repo.findByEmail.mockResolvedValue(buildPsicologo(true));
    hasher.compare.mockResolvedValue(false);
    await expect(
      useCase.execute(new LoginPsicologoCommand('ana@example.com', 'wrong')),
    ).rejects.toBeInstanceOf(InvalidCredentialsException);
  });

  it('throws EmailNotVerified when the account is not verified', async () => {
    repo.findByEmail.mockResolvedValue(buildPsicologo(false));
    hasher.compare.mockResolvedValue(true);
    await expect(
      useCase.execute(new LoginPsicologoCommand('ana@example.com', 'secret')),
    ).rejects.toBeInstanceOf(EmailNotVerifiedException);
  });

  it('returns tokens and the psicologo DTO on success', async () => {
    repo.findByEmail.mockResolvedValue(buildPsicologo(true));
    hasher.compare.mockResolvedValue(true);

    const result = await useCase.execute(new LoginPsicologoCommand('ana@example.com', 'secret'));

    expect(result.accessToken).toBe('access');
    expect(result.refreshToken).toBe('refresh');
    expect(result.psicologo.email).toBe('ana@example.com');
    // O DTO nunca expõe passwordHash.
    expect((result.psicologo as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });
});
