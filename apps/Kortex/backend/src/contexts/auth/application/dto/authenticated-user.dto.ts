import { User } from '../../../user/domain/entities/user.entity';
import { UserRole } from '../../../user/domain/value-objects/user-role.vo';

/** O usuário autenticado como o frontend o consome. Sem hash, sem qualquer campo interno. */
export class AuthenticatedUserDto {
  id!: string;
  name!: string;
  email!: string;
  role!: UserRole;
  accountId!: string;
  /** Quando true, o frontend leva direto para a troca de senha e não deixa sair de lá. */
  mustChangePassword!: boolean;

  static fromDomain(user: User): AuthenticatedUserDto {
    const dto = new AuthenticatedUserDto();
    dto.id = user.id.value;
    dto.name = user.name;
    dto.email = user.email.value;
    dto.role = user.role;
    dto.accountId = user.accountId.value;
    dto.mustChangePassword = user.mustChangePassword;
    return dto;
  }
}

export class AuthSessionDto {
  accessToken!: string;
  refreshToken!: string;
  user!: AuthenticatedUserDto;

  static create(tokens: { accessToken: string; refreshToken: string }, user: User): AuthSessionDto {
    const dto = new AuthSessionDto();
    dto.accessToken = tokens.accessToken;
    dto.refreshToken = tokens.refreshToken;
    dto.user = AuthenticatedUserDto.fromDomain(user);
    return dto;
  }
}
