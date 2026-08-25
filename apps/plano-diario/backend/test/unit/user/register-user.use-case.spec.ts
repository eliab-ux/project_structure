import { UserRepositoryPort } from '../../../src/contexts/user/application/ports/output/user-repository.port';
import { RegisterUserCommand } from '../../../src/contexts/user/application/use-cases/register-user/register-user.command';
import { RegisterUserUseCase } from '../../../src/contexts/user/application/use-cases/register-user/register-user.use-case';
import { UserAlreadyExistsException } from '../../../src/contexts/user/domain/exceptions/user-already-exists.exception';
import { PasswordHasherPort } from '../../../src/infrastructure/security/ports/password-hasher.port';

describe('RegisterUserUseCase', () => {
  let repository: jest.Mocked<UserRepositoryPort>;
  let hasher: jest.Mocked<PasswordHasherPort>;
  let useCase: RegisterUserUseCase;

  beforeEach(() => {
    repository = {
      save: jest.fn((user) => Promise.resolve(user)),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    hasher = {
      hash: jest.fn().mockResolvedValue('hash-bcrypt'),
      compare: jest.fn(),
    };
    useCase = new RegisterUserUseCase(repository, hasher);
  });

  it('cria a conta e devolve DTO sem passwordHash', async () => {
    const dto = await useCase.execute(
      new RegisterUserCommand('Eliab Caetano', 'Eliab@Exemplo.com', 'senha-forte-123', '(11) 91234-5678'),
    );

    expect(dto.email).toBe('eliab@exemplo.com');
    expect(dto.phone).toBe('(11) 91234-5678');
    expect(dto.role).toBe('user');
    expect(dto.isActive).toBe(true);
    expect(dto).not.toHaveProperty('passwordHash');
  });

  it('WhatsApp inválido barra o cadastro ANTES de gastar um hash de bcrypt', async () => {
    await expect(
      useCase.execute(
        // Sem DDD: o VO recusa, e recusar antes do hash economiza ~100ms num cadastro que falha.
        new RegisterUserCommand('Eliab', 'eliab@exemplo.com', 'senha-forte-123', '912345678'),
      ),
    ).rejects.toThrow('Informe um número de WhatsApp válido');

    expect(hasher.hash).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('normaliza o número para E.164 antes de persistir', async () => {
    await useCase.execute(
      new RegisterUserCommand('Eliab', 'eliab@exemplo.com', 'senha-forte-123', '11912345678'),
    );

    expect(repository.save.mock.calls[0][0].phone?.value).toBe('5511912345678');
  });

  it('nunca persiste a senha em claro', async () => {
    await useCase.execute(
      new RegisterUserCommand('Eliab Caetano', 'eliab@exemplo.com', 'senha-forte-123', '(11) 91234-5678'),
    );

    expect(hasher.hash).toHaveBeenCalledWith('senha-forte-123');
    const salvo = repository.save.mock.calls[0][0];
    expect(salvo.passwordHash).toBe('hash-bcrypt');
  });

  it('recusa e-mail já cadastrado sem chegar a hashear a senha', async () => {
    repository.exists.mockResolvedValue(true);

    await expect(
      useCase.execute(new RegisterUserCommand('Eliab', 'eliab@exemplo.com', 'senha-forte-123', '(11) 91234-5678')),
    ).rejects.toThrow(UserAlreadyExistsException);

    expect(hasher.hash).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });
});
