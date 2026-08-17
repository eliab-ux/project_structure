import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { BusinessHourRepositoryPort } from '../../../../contexts/account/application/ports/output/business-hour-repository.port';
import { BusinessHour } from '../../../../contexts/account/domain/entities/business-hour.entity';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { BusinessHourId } from '../../../../contexts/account/domain/value-objects/business-hour-id.vo';
import { BusinessHourOrmEntity } from '../entities/business-hour-orm.entity';
import { BusinessHourMapper } from '../mappers/business-hour.mapper';

@Injectable()
export class MikroOrmBusinessHourRepository implements BusinessHourRepositoryPort {
  constructor(
    @InjectRepository(BusinessHourOrmEntity)
    private readonly repo: EntityRepository<BusinessHourOrmEntity>,
    private readonly em: EntityManager,
    private readonly mapper: BusinessHourMapper,
  ) {}

  async listByAccount(accountId: AccountId): Promise<BusinessHour[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value },
      { orderBy: { weekday: 'ASC', startsAt: 'ASC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async listByAccountAndWeekday(accountId: AccountId, weekday: number): Promise<BusinessHour[]> {
    const rows = await this.repo.find(
      { accountId: accountId.value, weekday },
      { orderBy: { startsAt: 'ASC' } },
    );
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findById(accountId: AccountId, id: BusinessHourId): Promise<BusinessHour | null> {
    const orm = await this.repo.findOne({ accountId: accountId.value, id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async save(businessHour: BusinessHour): Promise<BusinessHour> {
    const existing = await this.repo.findOne({
      accountId: businessHour.accountId.value,
      id: businessHour.id.value,
    });
    const orm = this.mapper.toOrm(businessHour, existing ?? undefined);
    await this.em.persistAndFlush(orm);
    return this.mapper.toDomain(orm);
  }

  async delete(accountId: AccountId, id: BusinessHourId): Promise<void> {
    // O `accountId` no filtro do DELETE não é decoração: sem ele, um id vazado apagaria a janela
    // de outra conta.
    await this.em.nativeDelete(BusinessHourOrmEntity, {
      accountId: accountId.value,
      id: id.value,
    });
  }
}
