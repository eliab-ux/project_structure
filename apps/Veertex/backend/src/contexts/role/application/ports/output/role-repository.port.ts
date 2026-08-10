import { Role } from '../../../domain/entities/role.entity';
import { RoleId } from '../../../domain/value-objects/role-id.vo';

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

export interface RoleRepositoryPort {
  findById(id: RoleId): Promise<Role | null>;
  findByCode(code: string): Promise<Role | null>;
  listAll(): Promise<Role[]>;
  countAdministrative(): Promise<number>;
  save(role: Role): Promise<Role>;
  saveAll(roles: Role[]): Promise<Role[]>;
  softDelete(id: RoleId): Promise<void>;
}
