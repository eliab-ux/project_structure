import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import type { AbstractSqlConnection } from '@mikro-orm/postgresql';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { PhoneE164 } from '../../../../shared/domain/value-objects/phone-e164.vo';
import {
  AuthenticationLookupResult,
  UserRepositoryPort,
} from '../../../../contexts/user/application/ports/output/user-repository.port';
import { User } from '../../../../contexts/user/domain/entities/user.entity';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { UserStatus } from '../../../../contexts/user/domain/value-objects/user-status.vo';
import {
  AccessWindow,
  AccessWindowProps,
} from '../../../../contexts/user/domain/value-objects/access-window.vo';
import { RoleId } from '../../../../contexts/role/domain/value-objects/role-id.vo';
import { WILDCARD } from '../../../../contexts/role/domain/permissions.catalog';
import { RoleOrmEntity } from '../entities/role-orm.entity';
import { UserOrmEntity } from '../entities/user-orm.entity';
import { UserMapper } from '../mappers/user.mapper';

/** Row shape returned by the `veertex_auth_find_user_by_email` function. */
interface AuthLookupRow {
  id: string;
  account_id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  role_id: string;
  status: string;
  access_windows: AccessWindowProps[] | null;
  last_login_at: Date | null;
  created_at: Date;
}

@Injectable()
export class MikroOrmUserRepository implements UserRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: UserMapper,
  ) {}

  async findById(id: UserId): Promise<User | null> {
    const orm = await this.em.findOne(UserOrmEntity, { id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const orm = await this.em.findOne(UserOrmEntity, { email: email.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async listAll(): Promise<User[]> {
    const rows = await this.em.find(UserOrmEntity, {}, { orderBy: { name: 'ASC' } });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async countAll(): Promise<number> {
    return this.em.count(UserOrmEntity, {});
  }

  async countByRole(roleId: RoleId): Promise<number> {
    return this.em.count(UserOrmEntity, { roleId: roleId.value });
  }

  /**
   * Active users whose role grants full administration.
   *
   * Two scoped queries rather than one join, because both entities are tenant-filtered and the
   * filter applies per entity query — a hand-written join would have to restate the scope, which is
   * exactly the thing this design removes from every call site.
   *
   * The wildcard test is done in memory for the same reason as `RoleRepository.countAdministrative`:
   * the account's roles are a handful of rows, and a jsonb containment operator that serialises its
   * parameter wrongly would fail precisely in the check that keeps an account from locking itself out.
   */
  async countActiveAdministrators(): Promise<number> {
    const roles = await this.em.find(RoleOrmEntity, {});
    const adminRoles = roles.filter((role) => (role.permissions ?? []).includes(WILDCARD));
    if (adminRoles.length === 0) {
      return 0;
    }
    return this.em.count(UserOrmEntity, {
      status: UserStatus.ACTIVE,
      roleId: { $in: adminRoles.map((role) => role.id) },
    });
  }

  async save(user: User): Promise<User> {
    // upsert: no prior SELECT, so it also works during onboarding and login, before/without scope.
    const orm = await this.em.upsert(UserOrmEntity, this.mapper.toOrmData(user));
    await this.em.flush();
    return this.mapper.toDomain(orm);
  }

  /**
   * THE authentication lookup — the only read in the runtime path that crosses tenants.
   *
   * At login there is no JWT, therefore no tenant scope, therefore RLS on `users` would return
   * nothing; the e-mail is the only identifier the caller has. Rather than weakening the policy or
   * granting the runtime role a bypass, exactly one `security definer` function owned by the schema
   * owner is allowed to serve this one query, with a fixed column list. It is greppable, auditable,
   * and cannot be reshaped from application code.
   *
   * Everything downstream — the account, the role, the save — is scoped by the accountId this
   * returns (see `LoginUseCase`).
   */
  async findForAuthentication(email: Email): Promise<AuthenticationLookupResult | null> {
    const connection = this.em.getConnection() as unknown as AbstractSqlConnection;
    const rows = await connection.execute<AuthLookupRow[]>(
      'select * from veertex_auth_find_user_by_email(?)',
      [email.value],
      'all',
      this.em.getTransactionContext(),
    );

    const row = rows?.[0];
    if (!row) {
      return null;
    }

    return {
      accountId: row.account_id,
      user: User.reconstitute({
        id: UserId.from(row.id),
        accountId: row.account_id,
        name: row.name,
        email: Email.create(row.email),
        phone: PhoneE164.create(row.phone),
        passwordHash: row.password_hash,
        roleId: row.role_id,
        status: row.status as UserStatus,
        accessWindows: row.access_windows?.map((window) => AccessWindow.create(window)) ?? null,
        lastLoginAt: row.last_login_at,
        createdAt: row.created_at,
      }),
    };
  }
}
