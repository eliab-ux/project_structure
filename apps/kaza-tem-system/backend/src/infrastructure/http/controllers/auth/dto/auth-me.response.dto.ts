import { GetMeResult } from '@contexts/auth/application/use-cases/me/get-me.use-case';
import { ResellerDto } from '@contexts/reseller/application/dto/reseller.dto';
import { UserResponseDto } from '../../user/dto/user.response.dto';

export class AuthMeResponseDto {
  user!: UserResponseDto;
  reseller?: ResellerDto | null;

  static from(result: GetMeResult): AuthMeResponseDto {
    const response = new AuthMeResponseDto();
    response.user = UserResponseDto.fromDto(result.user);
    response.reseller = result.reseller;
    return response;
  }
}
