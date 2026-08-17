import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { PhoneChangeAuditRepositoryPort } from '../../../../contexts/user/application/ports/output/phone-change-audit-repository.port';
import { PhoneChangeAudit } from '../../../../contexts/user/domain/entities/phone-change-audit.entity';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { UserPhoneChangeAuditOrmEntity } from '../entities/user-phone-change-audit-orm.entity';
import { PhoneChangeAuditMapper } from '../mappers/phone-change-audit.mapper';

@Injectable()
export class MikroOrmPhoneChangeAuditRepository implements PhoneChangeAuditRepositoryPort {
  constructor(
    @InjectRepository(UserPhoneChangeAuditOrmEntity)
    private readonly repo: EntityRepository<UserPhoneChangeAuditOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: PhoneChangeAuditMapper,
  ) {}

  async save(audit: PhoneChangeAudit): Promise<PhoneChangeAudit> {
    const orm = this.mapper.toOrm(audit);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async listByUser(accountId: AccountId, userId: UserId): Promise<PhoneChangeAudit[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value, userId: userId.value },
      { orderBy: { createdAt: 'DESC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }
}
