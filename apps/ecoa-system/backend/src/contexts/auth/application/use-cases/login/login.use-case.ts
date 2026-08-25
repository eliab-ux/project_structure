import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  PASSWORD_HASHER,
  PasswordHasherPort,
} from '../../../../../infrastructure/security/ports/password-hasher.port';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from '../../../../../infrastructure/security/ports/token-service.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { Email } from '../../../../user/domain/value-objects/email.vo';
import { InvalidCredentialsException } from '../../../../user/domain/exceptions/invalid-credentials.exception';
import { AuthTokensDto } from '../../dto/auth-tokens.dto';
import { LoginCommand } from './login.command';

@Injectable()
export class LoginUseCase implements UseCase<LoginCommand, AuthTokensDto> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort,
  ) {}

  async execute(command: LoginCommand): Promise<AuthTokensDto> {
    const user = await this.userRepository.findByEmail(Email.create(command.email));

    // Uniform failure whether the user exists or the password is wrong — no enumeration.
    if (!user || !user.active) {
      throw new InvalidCredentialsException();
    }

    const valid = await this.passwordHasher.compare(command.password, user.passwordHash);
    if (!valid) {
      throw new InvalidCredentialsException();
    }

    const payload = { sub: user.id.value, email: user.email.value, role: user.role.value };
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(payload),
    ]);

    return new AuthTokensDto(accessToken, refreshToken);
  }
}
