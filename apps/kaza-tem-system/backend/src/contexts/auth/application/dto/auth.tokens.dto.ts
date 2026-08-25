import { ResellerDto } from '@contexts/reseller/application/dto/reseller.dto';
import { UserDto } from '@contexts/user/application/dto/user.dto';

export class AuthTokensDto {
  constructor(
    public readonly accessToken: string,
    public readonly refreshToken: string,
  ) {}
}

export class AuthLoginResult {
  constructor(
    public readonly tokens: AuthTokensDto,
    public readonly user: UserDto,
    public readonly reseller: ResellerDto | null,
  ) {}
}
