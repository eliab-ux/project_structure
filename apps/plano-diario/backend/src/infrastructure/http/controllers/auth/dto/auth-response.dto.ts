import { AuthSessionDto } from '../../../../../contexts/auth/application/dto/auth-session.dto';
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

/** Mapeamento explícito, campo por campo: `passwordHash` não existe aqui por decisão. */
export class UserResponseDto {
  id!: string;
  email!: string;
  name!: string;
  /** O próprio número do dono da conta, formatado. `null` em conta criada antes do campo. */
  phone!: string | null;
  role!: string;
  isActive!: boolean;
  createdAt!: Date;

  static fromDto(user: UserDto): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.name = user.name;
    dto.phone = user.phone;
    dto.role = user.role;
    dto.isActive = user.isActive;
    dto.createdAt = user.createdAt;
    return dto;
  }
}

export class LoginResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: UserResponseDto;

  static fromSession(session: AuthSessionDto): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.accessToken = session.accessToken;
    dto.refreshToken = session.refreshToken;
    dto.user = UserResponseDto.fromDto(session.user);
    return dto;
  }
}
