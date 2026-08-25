import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { UserRepositoryPort } from '../../../../contexts/user/application/ports/output/user-repository.port';
import { User } from '../../../../contexts/user/domain/entities/user.entity';
import { Email } from '../../../../contexts/user/domain/value-objects/email.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { UserOrmEntity } from '../entities/user-orm.entity';
import { TENANT_FILTER } from '../entities/tenant-scoped-orm.entity';
import { UserMapper } from '../mappers/user.mapper';

/**
 * Every read here is tenant-scoped by the inherited global filter — note the absence of any
 * `accountId` parameter, which is the whole point: there is nothing to forget.
 *
 * The single exception is `findByEmailForAuthentication`, which disables the filter explicitly.
 * Grep for `[TENANT_FILTER]: false` and this is the only place in the tenant path where it
 * appears; the reason is spelled out at the call site.
 */
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

  async listByAccount(): Promise<User[]> {
    const rows = await this.em.find(UserOrmEntity, {}, { orderBy: { name: 'ASC' } });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async save(user: User): Promise<User> {
    // upsert: no prior SELECT, so it also works during login, before any tenant scope exists.
    const orm = await this.em.upsert(UserOrmEntity, this.mapper.toOrmData(user));
    await this.em.flush();
    return this.mapper.toDomain(orm);
  }

  async findByEmailForAuthentication(email: Email): Promise<User | null> {
    // Unscoped BY NECESSITY: at login there is no JWT, therefore no tenant. The e-mail is the
    // identifier. Everything downstream scopes by the accountId found on this user.
    const orm = await this.em.findOne(
      UserOrmEntity,
      { email: email.value },
      { filters: { [TENANT_FILTER]: false } },
    );
    return orm ? this.mapper.toDomain(orm) : null;
  }
}
