import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { AuthTokensDto, AuthLoginResult } from '../../dto/auth.tokens.dto';
import { LoginAdminCommand } from './login-admin.command';
import {
  TOKEN_SERVICE,
  TokenServicePort,
  AuthTokenPayload,
} from '@infrastructure/security/ports/token-service.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@contexts/user/application/ports/output/user-repository.port';
import { Email } from '@contexts/user/domain/value-objects/email.vo';
import { InvalidCredentialsException } from '@contexts/user/domain/exceptions/invalid-credentials.exception';
import { SupabaseAuthService } from '@infrastructure/security/supabase-auth.service';
import { UserDto } from '@contexts/user/application/dto/user.dto';

@Injectable()
export class LoginAdminUseCase implements UseCase<LoginAdminCommand, AuthLoginResult> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort,
    private readonly supabaseAuthService: SupabaseAuthService,
  ) {}

  async execute(command: LoginAdminCommand): Promise<AuthLoginResult> {
    const email = Email.create(command.email);
    try {
      await this.supabaseAuthService.signIn(email.value, command.password);
    } catch (error) {
      throw new InvalidCredentialsException();
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user || user.role.value !== 'admin') {
      throw new InvalidCredentialsException();
    }

    const payload: AuthTokenPayload = {
      sub: user.id.value,
      email: user.email.value,
      role: 'admin',
    };

    const accessToken = await this.tokenService.signAccessToken(payload);
    const refreshToken = await this.tokenService.signRefreshToken(payload);

    return new AuthLoginResult(
      new AuthTokensDto(accessToken, refreshToken),
      UserDto.fromDomain(user),
      null,
    );
  }
}
