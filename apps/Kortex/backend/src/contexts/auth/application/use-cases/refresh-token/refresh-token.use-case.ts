import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { TOKEN_SERVICE, TokenServicePort } from '../../ports/output/token-service.port';
import { AuthSessionDto } from '../../dto/authenticated-user.dto';
import { InvalidCredentialsException } from '../../../domain/exceptions/invalid-credentials.exception';
import { AccountId } from '../../../../account/domain/value-objects/account-id.vo';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';

export class RefreshTokenCommand {
  constructor(public readonly refreshToken: string) {}
}

@Injectable()
export class RefreshTokenUseCase implements UseCase<RefreshTokenCommand, AuthSessionDto> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepositoryPort,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: TokenServicePort,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<AuthSessionDto> {
    let payload;
    try {
      payload = this.tokenService.verifyRefreshToken(command.refreshToken);
    } catch {
      throw new InvalidCredentialsException();
    }

    // O usuário é recarregado a cada refresh, e não reconstruído a partir do token. É o que faz o
    // desligamento valer na hora: quem foi inativado às 14h não continua renovando o acesso até o
    // refresh token vencer sete dias depois. O papel também vem do banco, não do token — assim uma
    // mudança de papel não espera a expiração para valer.
    const user = await this.userRepository.findById(
      AccountId.from(payload.accountId),
      UserId.from(payload.sub),
    );

    if (!user || !user.canAuthenticate()) {
      throw new InvalidCredentialsException();
    }

    const tokens = this.tokenService.issue({
      sub: user.id.value,
      role: user.role,
      accountId: user.accountId.value,
    });

    return AuthSessionDto.create(tokens, user);
  }
}
