import { UserDto } from '../../../user/application/dto/user.dto';

export interface AuthResultDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserDto;
  accountId: string;
  /** Effective permissions, so the frontend can build the menu without a second call. */
  permissions: string[];
  /** `plano ∩ conta` — a outra metade do que o menu precisa para decidir o que mostrar. */
  modules: string[];
}

export interface RefreshResultDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
