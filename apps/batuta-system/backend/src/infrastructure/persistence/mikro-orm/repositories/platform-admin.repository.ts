import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PlatformAdminRepositoryPort } from '../../../../contexts/platform/application/ports/output/platform-admin-repository.port';
import { PlatformAdmin } from '../../../../contexts/platform/domain/entities/platform-admin.entity';
import { PlatformAdminId } from '../../../../contexts/platform/domain/value-objects/platform-admin-id.vo';
import { Email } from '../../../../contexts/user/domain/value-objects/email.vo';
import { PlatformAdminOrmEntity } from '../entities/platform-admin-orm.entity';
import { PlatformAdminMapper } from '../mappers/platform-admin.mapper';

/** No tenant filter applies — the table has no account_id, so nothing here can leak across tenants. */
@Injectable()
export class MikroOrmPlatformAdminRepository implements PlatformAdminRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: PlatformAdminMapper,
  ) {}

  async findById(id: PlatformAdminId): Promise<PlatformAdmin | null> {
    const orm = await this.em.findOne(PlatformAdminOrmEntity, { id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByEmail(email: Email): Promise<PlatformAdmin | null> {
    const orm = await this.em.findOne(PlatformAdminOrmEntity, { email: email.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(admin: PlatformAdmin): Promise<PlatformAdmin> {
    const orm = await this.em.upsert(PlatformAdminOrmEntity, this.mapper.toOrmData(admin));
    await this.em.flush();
    return this.mapper.toDomain(orm);
  }
}
