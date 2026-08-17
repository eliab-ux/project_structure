import { User } from '../../domain/entities/user.entity';
import { UserRole } from '../../domain/value-objects/user-role.vo';

/**
 * Usuário como a tela de Equipe o consome.
 *
 * `passwordHash` **não é mapeado** — a ausência é intencional e é a regra do CLAUDE.md. O mesmo
 * vale para qualquer campo que venha a existir e não sirva à tela: o mapeamento é explícito
 * justamente para que acrescentar um campo na entidade não o publique por acidente.
 */
export class UserDto {
  id!: string;
  name!: string;
  email!: string;
  phone!: string;
  role!: UserRole;
  isActive!: boolean;
  mustChangePassword!: boolean;
  lastLoginAt!: string | null;

  static fromDomain(user: User): UserDto {
    const dto = new UserDto();
    dto.id = user.id.value;
    dto.name = user.name;
    dto.email = user.email.value;
    dto.phone = user.phone.value;
    dto.role = user.role;
    dto.isActive = user.isActive;
    dto.mustChangePassword = user.mustChangePassword;
    dto.lastLoginAt = user.lastLoginAt?.toISOString() ?? null;
    // passwordHash nunca é mapeado — ausência intencional.
    return dto;
  }
}
