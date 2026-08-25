import { AuthLoginResult } from '@contexts/auth/application/dto/auth.tokens.dto';
import { ResellerDto } from '@contexts/reseller/application/dto/reseller.dto';
import { UserResponseDto } from '../../user/dto/user.response.dto';

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: UserResponseDto;
  reseller?: ResellerDto | null;

  static from(result: AuthLoginResult): AuthResponseDto {
    const response = new AuthResponseDto();
    response.accessToken = result.tokens.accessToken;
    response.refreshToken = result.tokens.refreshToken;
    response.user = UserResponseDto.fromDto(result.user);
    response.reseller = result.reseller;
    return response;
  }
}
