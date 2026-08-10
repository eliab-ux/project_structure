import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { PlanRepositoryPort } from '../../../../contexts/plan/application/ports/output/plan-repository.port';
import { Plan } from '../../../../contexts/plan/domain/entities/plan.entity';
import { PlanOrmEntity } from '../entities/plan-orm.entity';
import { PlanMapper } from '../mappers/plan.mapper';

/**
 * Plans are global, so these reads carry no tenant scope — correct rather than an oversight. The
 * runtime role has SELECT and nothing else on this table; writing the catalogue is an owner
 * operation (migration or seed).
 */
@Injectable()
export class MikroOrmPlanRepository implements PlanRepositoryPort {
  constructor(
    private readonly em: EntityManager,
    private readonly mapper: PlanMapper,
  ) {}

  async findById(id: string): Promise<Plan | null> {
    const orm = await this.em.findOne(PlanOrmEntity, { id });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async findByCode(code: string): Promise<Plan | null> {
    const orm = await this.em.findOne(PlanOrmEntity, { code: code.trim().toUpperCase() });
    return orm ? this.mapper.toDomain(orm) : null;
  }

  async listActive(): Promise<Plan[]> {
    const rows = await this.em.find(PlanOrmEntity, { active: true }, { orderBy: { name: 'ASC' } });
    return rows.map((orm) => this.mapper.toDomain(orm));
  }
}
