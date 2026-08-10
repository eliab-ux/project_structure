import { Role } from '../../domain/entities/role.entity';

export class RoleDto {
  id!: string;
  code!: string;
  name!: string;
  description!: string | null;
  permissions!: string[];
  isSystem!: boolean;
  isAdministrative!: boolean;
  createdAt!: Date;

  static fromDomain(role: Role): RoleDto {
    const dto = new RoleDto();
    dto.id = role.id.value;
    dto.code = role.code;
    dto.name = role.name;
    dto.description = role.description;
    dto.permissions = [...role.permissions.values];
    dto.isSystem = role.isSystem;
    dto.isAdministrative = role.isAdministrative;
    dto.createdAt = role.createdAt;
    return dto;
  }
}
