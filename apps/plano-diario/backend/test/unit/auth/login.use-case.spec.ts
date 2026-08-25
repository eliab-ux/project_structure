import { LoginCommand } from '../../../src/contexts/auth/application/use-cases/login/login.command';
import { LoginUseCase } from '../../../src/contexts/auth/application/use-cases/login/login.use-case';
import { UserRepositoryPort } from '../../../src/contexts/user/application/ports/output/user-repository.port';
import { User } from '../../../src/contexts/user/domain/entities/user.entity';
import { InvalidCredentialsException } from '../../../src/contexts/user/domain/exceptions/invalid-credentials.exception';
import { Email } from '../../../src/contexts/user/domain/value-objects/email.vo';
import { PhoneNumber } from '../../../src/contexts/user/domain/value-objects/phone-number.vo';
import { PasswordHasherPort } from '../../../src/infrastructure/security/ports/password-hasher.port';
import { TokenServicePort } from '../../../src/infrastructure/security/ports/token-service.port';

describe('LoginUseCase', () => {
  let repository: jest.Mocked<UserRepositoryPort>;
  let hasher: jest.Mocked<PasswordHasherPort>;
  let tokenService: jest.Mocked<TokenServicePort>;
  let useCase: LoginUseCase;
  let user: User;

  beforeEach(() => {
    user = User.register(
      Email.create('eliab@exemplo.com'),
      'Eliab Caetano',
      'hash-bcrypt',
      PhoneNumber.create('(11) 91234-5678'),
    );
    user.pullDomainEvents();

    repository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(user),
      exists: jest.fn(),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    hasher = { hash: jest.fn(), compare: jest.fn().mockResolvedValue(true) };
    tokenService = {
      signAccessToken: jest.fn().mockResolvedValue('access-token'),
      signRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };
    useCase = new LoginUseCase(repository, hasher, tokenService);
  });

  it('emite os dois tokens e devolve o usuário sem hash', async () => {
    const session = await useCase.execute(
      new LoginCommand('eliab@exemplo.com', 'senha-correta-123'),
    );

    expect(session.accessToken).toBe('access-token');
    expect(session.refreshToken).toBe('refresh-token');
    expect(session.user.email).toBe('eliab@exemplo.com');
    expect(session.user).not.toHaveProperty('passwordHash');
  });

  it('assina apenas os claims mínimos (sub, email, role)', async () => {
    await useCase.execute(new LoginCommand('eliab@exemplo.com', 'senha-correta-123'));

    const payload = tokenService.signAccessToken.mock.calls[0][0];
    expect(Object.keys(payload).sort()).toEqual(['email', 'role', 'sub']);
  });

  it('senha errada → InvalidCredentialsException', async () => {
    hasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute(new LoginCommand('eliab@exemplo.com', 'senha-errada')),
    ).rejects.toThrow(InvalidCredentialsException);
    expect(tokenService.signAccessToken).not.toHaveBeenCalled();
  });

  it('usuário inexistente → mesma exceção da senha errada (anti-enumeração)', async () => {
    repository.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute(new LoginCommand('naoexiste@exemplo.com', 'qualquer-senha')),
    ).rejects.toThrow('Credenciais inválidas');
  });

  it('conta desativada não autentica mesmo com a senha certa', async () => {
    user.deactivate();

    await expect(
      useCase.execute(new LoginCommand('eliab@exemplo.com', 'senha-correta-123')),
    ).rejects.toThrow(InvalidCredentialsException);
    expect(hasher.compare).not.toHaveBeenCalled();
  });
});
