import { Injectable } from '@nestjs/common';
import { Plan } from '../../../../contexts/plan/domain/entities/plan.entity';
import { PlanLimits } from '../../../../contexts/plan/domain/value-objects/plan-limits.vo';
import { PlanOrmEntity } from '../entities/plan-orm.entity';

@Injectable()
export class PlanMapper {
  toDomain(orm: PlanOrmEntity): Plan {
    return Plan.reconstitute({
      id: orm.id,
      code: orm.code,
      name: orm.name,
      limits: PlanLimits.create(orm.limits ?? {}),
      active: orm.active,
      createdAt: orm.createdAt,
    });
  }

  toOrmData(plan: Plan): Record<string, unknown> {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      limits: plan.limits.toJSON(),
      active: plan.active,
      createdAt: plan.createdAt,
    };
  }
}
