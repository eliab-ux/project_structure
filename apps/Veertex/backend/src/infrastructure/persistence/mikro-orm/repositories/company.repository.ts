import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { CompanyRepositoryPort } from '../../../../contexts/company/application/ports/output/company-repository.port';
import { Company } from '../../../../contexts/company/domain/entities/company.entity';
import { CompanyId } from '../../../../contexts/company/domain/value-objects/company-id.vo';
import { CompanyOrmEntity } from '../entities/company-orm.entity';
import { CompanyMapper } from '../mappers/company.mapper';

/**
 * Note the absence of any `accountId` parameter: the inherited global filter and the RLS policy
 * scope every one of these reads. There is nothing to forget.
 */
@Injectable()
export class MikroOrmCompanyRepository implements CompanyRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: CompanyMapper,
  ) {}

  async findById(id: CompanyId): Promise<Company | null> {
    const orm = await this.em.findOne(CompanyOrmEntity, { id: id.value });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByDocument(document: string): Promise<Company | null> {
    const orm = await this.em.findOne(CompanyOrmEntity, { document });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async listAll(): Promise<Company[]> {
    const rows = await this.em.find(CompanyOrmEntity, {}, { orderBy: { legalName: 'ASC' } });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }

  async countAll(): Promise<number> {
    return this.em.count(CompanyOrmEntity, {});
  }

  async countActive(): Promise<number> {
    return this.em.count(CompanyOrmEntity, { active: true });
  }

  async save(company: Company): Promise<Company> {
    const orm = await this.em.upsert(CompanyOrmEntity, this.mapper.toOrmData(company));
    await this.em.flush();
    return this.mapper.toDomain(orm);
  }
}
