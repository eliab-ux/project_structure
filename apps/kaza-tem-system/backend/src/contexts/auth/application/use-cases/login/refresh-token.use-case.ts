import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { RefreshTokenCommand } from './refresh-token.command';
import { AuthTokensDto, AuthLoginResult } from '../../dto/auth.tokens.dto';
import {
  TOKEN_SERVICE,
  TokenServicePort,
  AuthTokenPayload,
} from '@infrastructure/security/ports/token-service.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '@contexts/user/application/ports/output/user-repository.port';
import {
  RESELLER_REPOSITORY,
  ResellerRepositoryPort,
} from '@contexts/reseller/application/ports/output/reseller-repository.port';
import { UserId } from '@contexts/user/domain/value-objects/user-id.vo';
import { UserNotFoundException } from '@contexts/user/domain/exceptions/user-not-found.exception';
import { ResellerNotFoundException } from '@contexts/reseller/domain/exceptions/reseller-not-found.exception';
import { UserDto } from '@contexts/user/application/dto/user.dto';
import { ResellerDto } from '@contexts/reseller/application/dto/reseller.dto';
import { InvalidCredentialsException } from '@contexts/user/domain/exceptions/invalid-credentials.exception';

@Injectable()
export class RefreshTokenUseCase implements UseCase<RefreshTokenCommand, AuthLoginResult> {
  constructor(
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenServicePort,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<AuthLoginResult> {
    let payload: AuthTokenPayload;
    try {
      payload = await this.tokenService.verifyRefreshToken(command.refreshToken);
    } catch {
      throw new InvalidCredentialsException();
    }

    if (!payload.sub) {
      throw new InvalidCredentialsException();
    }

    const user = await this.userRepository.findById(UserId.from(payload.sub));
    if (!user) {
      throw new UserNotFoundException(payload.sub);
    }

    let reseller: ResellerDto | null = null;
    const refreshedPayload: AuthTokenPayload = {
      sub: user.id.value,
      email: user.email.value,
      role: payload.role,
    };

    if (payload.role === 'reseller') {
      const found = await this.resellerRepository.findByUserId(user.id.value);
      if (!found) {
        throw new ResellerNotFoundException(user.id.value);
      }
      reseller = ResellerDto.fromDomain(found);
      refreshedPayload.resellerId = found.id.value;
    }

    const accessToken = await this.tokenService.signAccessToken(refreshedPayload);
    const refreshToken = await this.tokenService.signRefreshToken(refreshedPayload);

    return new AuthLoginResult(
      new AuthTokensDto(accessToken, refreshToken),
      UserDto.fromDomain(user),
      reseller,
    );
  }
}
