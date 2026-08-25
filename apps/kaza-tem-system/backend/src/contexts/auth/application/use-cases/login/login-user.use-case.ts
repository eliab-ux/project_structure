import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { AuthTokensDto, AuthLoginResult } from '../../dto/auth.tokens.dto';
import { LoginUserCommand } from './login.command';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@contexts/user/application/ports/output/user-repository.port';
import {
  RESELLER_REPOSITORY,
  ResellerRepositoryPort,
} from '@contexts/reseller/application/ports/output/reseller-repository.port';
import {
  TOKEN_SERVICE,
  TokenServicePort,
  AuthTokenPayload,
} from '@infrastructure/security/ports/token-service.port';
import { SupabaseAuthService } from '@infrastructure/security/supabase-auth.service';
import { Email } from '@contexts/user/domain/value-objects/email.vo';
import { InvalidCredentialsException } from '@contexts/user/domain/exceptions/invalid-credentials.exception';
import { ResellerNotFoundException } from '@contexts/reseller/domain/exceptions/reseller-not-found.exception';
import { UserDto } from '@contexts/user/application/dto/user.dto';
import { ResellerDto } from '@contexts/reseller/application/dto/reseller.dto';
import { AuthError, AuthInvalidCredentialsError } from '@supabase/auth-js';

@Injectable()
export class LoginUserUseCase implements UseCase<LoginUserCommand, AuthLoginResult> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenServicePort,
    private readonly supabaseAuthService: SupabaseAuthService,
  ) {}

  async execute(command: LoginUserCommand): Promise<AuthLoginResult> {
    const email = Email.create(command.email);
    try {
      await this.supabaseAuthService.signIn(email.value, command.password);
    } catch (error) {
      if (
        error instanceof AuthInvalidCredentialsError ||
        (error instanceof AuthError && error.status === 400)
      ) {
        throw new InvalidCredentialsException();
      }

      throw error;
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsException();
    }

    const reseller = await this.resellerRepository.findByUserId(user.id.value);
    if (!reseller) {
      throw new ResellerNotFoundException(user.id.value);
    }

    const payload: AuthTokenPayload = {
      sub: user.id.value,
      email: user.email.value,
      resellerId: reseller.id.value,
      role: 'reseller',
    };

    const accessToken = await this.tokenService.signAccessToken(payload);
    const refreshToken = await this.tokenService.signRefreshToken(payload);

    return new AuthLoginResult(
      new AuthTokensDto(accessToken, refreshToken),
      UserDto.fromDomain(user),
      ResellerDto.fromDomain(reseller),
    );
  }
}
