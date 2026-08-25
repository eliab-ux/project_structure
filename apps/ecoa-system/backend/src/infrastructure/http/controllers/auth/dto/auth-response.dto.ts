import { AuthTokensDto } from '../../../../../contexts/auth/application/dto/auth-tokens.dto';
import { UserDto } from '../../../../../contexts/user/application/dto/user.dto';

export class TokensResponseDto {
  accessToken!: string;
  refreshToken!: string;

  static fromTokens(tokens: AuthTokensDto): TokensResponseDto {
    const dto = new TokensResponseDto();
    dto.accessToken = tokens.accessToken;
    dto.refreshToken = tokens.refreshToken;
    return dto;
  }
}

export class UserResponseDto {
  id!: string;
  email!: string;
  name!: string;
  role!: string;
  active!: boolean;
  createdAt!: Date;

  static fromDto(user: UserDto): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.name = user.name;
    dto.role = user.role;
    dto.active = user.active;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
