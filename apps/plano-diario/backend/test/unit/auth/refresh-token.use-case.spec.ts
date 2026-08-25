import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenUseCase } from '../../../src/contexts/auth/application/use-cases/refresh/refresh-token.use-case';
import { UserRepositoryPort } from '../../../src/contexts/user/application/ports/output/user-repository.port';
import { User } from '../../../src/contexts/user/domain/entities/user.entity';
import { Email } from '../../../src/contexts/user/domain/value-objects/email.vo';
import { PhoneNumber } from '../../../src/contexts/user/domain/value-objects/phone-number.vo';
import { TokenServicePort } from '../../../src/infrastructure/security/ports/token-service.port';

describe('RefreshTokenUseCase', () => {
  let repository: jest.Mocked<UserRepositoryPort>;
  let tokenService: jest.Mocked<TokenServicePort>;
  let useCase: RefreshTokenUseCase;
  let user: User;

  beforeEach(() => {
    user = User.register(
      Email.create('eliab@exemplo.com'),
      'Eliab Caetano',
      'hash',
      PhoneNumber.create('(11) 91234-5678'),
    );
    user.pullDomainEvents();

    repository = {
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(user),
      findByEmail: jest.fn(),
      exists: jest.fn(),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    tokenService = {
      signAccessToken: jest.fn().mockResolvedValue('novo-access'),
      signRefreshToken: jest.fn().mockResolvedValue('novo-refresh'),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn().mockResolvedValue({
        sub: user.id.value,
        email: user.email.value,
        role: 'user',
      }),
    };
    useCase = new RefreshTokenUseCase(tokenService, repository);
  });

  it('troca o refresh token por um par novo', async () => {
    const tokens = await useCase.execute({ refreshToken: 'refresh-valido' });
    expect(tokens.accessToken).toBe('novo-access');
    expect(tokens.refreshToken).toBe('novo-refresh');
  });

  it('refresh token inválido → 401', async () => {
    tokenService.verifyRefreshToken.mockRejectedValue(new Error('invalid signature'));
    await expect(useCase.execute({ refreshToken: 'lixo' })).rejects.toThrow(UnauthorizedException);
  });

  it('conta desativada depois da emissão → 401 (desativar corta a renovação)', async () => {
    user.deactivate();
    await expect(useCase.execute({ refreshToken: 'refresh-valido' })).rejects.toThrow(
      'Refresh token inválido ou expirado',
    );
    expect(tokenService.signAccessToken).not.toHaveBeenCalled();
  });

  it('usuário removido → 401', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute({ refreshToken: 'refresh-valido' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
