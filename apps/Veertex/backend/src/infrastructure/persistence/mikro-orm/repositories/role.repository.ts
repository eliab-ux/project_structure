import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { RoleRepositoryPort } from '../../../../contexts/role/application/ports/output/role-repository.port';
import { Role } from '../../../../contexts/role/domain/entities/role.entity';
import { RoleId } from '../../../../contexts/role/domain/value-objects/role-id.vo';
import { WILDCARD } from '../../../../contexts/role/domain/permissions.catalog';
import { RoleOrmEntity } from '../entities/role-orm.entity';
import { RoleMapper } from '../mappers/role.mapper';

@Injectable()
export class MikroOrmRoleRepository implements RoleRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: RoleMapper,
  ) {}

  async findById(id: RoleId): Promise<Role | null> {
    const orm = await this.em.findOne(RoleOrmEntity, { id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByCode(code: string): Promise<Role | null> {
    const orm = await this.em.findOne(RoleOrmEntity, { code: code.trim().toUpperCase() });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async listAll(): Promise<Role[]> {
    const rows = await this.em.find(RoleOrmEntity, {}, { orderBy: { name: 'ASC' } });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  /**
   * Counts roles holding the global wildcard — the "can this account still be administered?" check.
   *
   * Loads the account's roles and filters in memory rather than pushing a `@>` down to the jsonb
   * column. Two reasons, and the second is the one that decided it:
   *
   *  - the set is tiny and bounded: seven seeded roles plus whatever the account added. This is not
   *    a table scan, it is a handful of rows already scoped by the tenant filter;
   *  - the ORM's jsonb containment operator depends on the parameter being serialised as JSONB
   *    rather than as a Postgres array, and getting that wrong fails at runtime, in the one query
   *    that decides whether an account can still be administered. Not worth the cleverness.
   *
   * Consistency is unaffected: this runs inside the request's transaction, like every other read.
   */
  async countAdministrative(): Promise<number> {
    const rows = await this.em.find(RoleOrmEntity, {});
    return rows.filter((role) => (role.permissions ?? []).includes(WILDCARD)).length;
  }

  async save(role: Role): Promise<Role> {
    const orm = await this.em.upsert(RoleOrmEntity, this.mapper.toOrmData(role));
    await this.em.flush();
    return this.mapper.toDomain(orm);
  }

  async saveAll(roles: Role[]): Promise<Role[]> {
    if (roles.length === 0) {
      return [];
    }
    const rows = await this.em.upsertMany(
      RoleOrmEntity,
      roles.map((role) => this.mapper.toOrmData(role)),
    );
    await this.em.flush();
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  /** Soft delete: the row stays for audit and for any historical reference to it. */
  async softDelete(id: RoleId): Promise<void> {
    await this.em.nativeUpdate(RoleOrmEntity, { id: id.value }, { deletedAt: new Date() });
  }
}
