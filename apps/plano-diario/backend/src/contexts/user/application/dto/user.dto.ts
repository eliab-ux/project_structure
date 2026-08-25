import { User } from '../../domain/entities/user.entity';

/**
 * Visão do usuário no limite da aplicação. Nunca carrega passwordHash — a ausência é
 * intencional e é o que garante que nenhum controller consiga expor o hash por acidente.
 */
export class UserDto {
  id!: string;
  email!: string;
  name!: string;
  /** Como o usuário reconhece o próprio número: `(11) 91234-5678`. `null` em conta antiga. */
  phone!: string | null;
  role!: string;
  isActive!: boolean;
  createdAt!: Date;

  static fromDomain(user: User): UserDto {
    const dto = new UserDto();
    dto.id = user.id.value;
    dto.email = user.email.value;
    dto.name = user.name;
    dto.phone = user.phone?.formatted ?? null;
    dto.role = user.role.value;
    dto.isActive = user.isActive;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
