import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from '../../../../../infrastructure/security/ports/token-service.port';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';
import { AuthTokensDto } from '../../dto/auth-tokens.dto';

@Injectable()
export class RefreshTokenUseCase implements UseCase<{ refreshToken: string }, AuthTokensDto> {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
  ) {}

  async execute(command: { refreshToken: string }): Promise<AuthTokensDto> {
    let decoded;
    try {
      decoded = await this.tokenService.verifyRefreshToken(command.refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // Re-check the user still exists and is active before minting new tokens.
    const user = await this.userRepository.findById(UserId.from(decoded.sub));
    if (!user || !user.active) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const payload = { sub: user.id.value, email: user.email.value, role: user.role.value };
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(payload),
    ]);
    return new AuthTokensDto(accessToken, refreshToken);
  }
}
