import { AuthTokensDto } from '@contexts/auth/application/dto/auth.tokens.dto';
import { UserResponseDto } from '../../user/dto/user.response.dto';

export class AdminAuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: UserResponseDto;

  static from(tokens: AuthTokensDto, user: UserResponseDto): AdminAuthResponseDto {
    const response = new AdminAuthResponseDto();
    response.accessToken = tokens.accessToken;
    response.refreshToken = tokens.refreshToken;
    response.user = user;
    return response;
  }
}
