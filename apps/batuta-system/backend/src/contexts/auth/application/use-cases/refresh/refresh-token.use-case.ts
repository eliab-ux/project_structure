import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  USER_REPOSITORY,
  UserRepositoryPort,
} from '../../../../user/application/ports/output/user-repository.port';
import { UserId } from '../../../../user/domain/value-objects/user-id.vo';
import { UnauthorizedTokenException } from '../../../domain/exceptions/invalid-token.exception';
import { TOKEN_SERVICE, TokenServicePort } from '../../ports/output/token-service.port';
import { RefreshResultDto } from '../../dto/auth-result.dto';
import { RefreshTokenCommand } from './refresh-token.command';

/**
 * Exchanges a refresh token for a new pair.
 *
 * The token is not trusted on its own: the user is re-read and re-checked, so a user disabled
 * five minutes ago cannot keep refreshing their way into the system. The tenant scope for that
 * read comes from the token's own `accountId`, established by the caller before this runs.
 */
@Injectable()
export class RefreshTokenUseCase implements UseCase<RefreshTokenCommand, RefreshResultDto> {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshResultDto> {
    const payload = this.tokens.verifyRefreshToken(command.refreshToken);

    const user = await this.users.findById(UserId.from(payload.sub));
    if (!user || !user.isActive) {
      throw new UnauthorizedTokenException();
    }

    // Role is re-read from the database, never carried over from the old token: a demoted user
    // must not keep ACCOUNT_ADMIN by refreshing.
    const issued = this.tokens.issueForUser({
      sub: user.id.value,
      accountId: user.accountId,
      role: user.role,
    });

    const result = new RefreshResultDto();
    result.accessToken = issued.accessToken;
    result.refreshToken = issued.refreshToken;
    result.expiresIn = issued.expiresIn;
    return result;
  }
}
