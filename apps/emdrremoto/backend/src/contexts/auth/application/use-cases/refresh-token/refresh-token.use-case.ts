import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import {
  TOKEN_SERVICE,
  TokenServicePort,
} from '../../../../../infrastructure/security/ports/token-service.port';
import { TokensDto } from '../../dto/auth-result.dto';

export class RefreshTokenCommand {
  constructor(public readonly refreshToken: string) {}
}

@Injectable()
export class RefreshTokenUseCase implements UseCase<RefreshTokenCommand, TokensDto> {
  constructor(@Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort) {}

  async execute(command: RefreshTokenCommand): Promise<TokensDto> {
    let payload;
    try {
      payload = await this.tokens.verifyRefreshToken(command.refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const claims = {
      sub: payload.sub,
      role: payload.role,
      email: payload.email,
      nome: payload.nome,
      sessionCode: payload.sessionCode,
    };

    return {
      accessToken: await this.tokens.signAccessToken(claims),
      refreshToken: await this.tokens.signRefreshToken(claims),
    };
  }
}
