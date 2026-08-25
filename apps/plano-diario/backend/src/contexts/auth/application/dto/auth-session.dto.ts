import { UserDto } from '../../../user/application/dto/user.dto';

/** Resultado do login: os tokens + o usuário já carregado (evita um segundo SELECT no /me). */
export class AuthSessionDto {
  constructor(
    public readonly accessToken: string,
    public readonly refreshToken: string,
    public readonly user: UserDto,
  ) {}
}
