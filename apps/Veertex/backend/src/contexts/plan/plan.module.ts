import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PLAN_REPOSITORY } from './application/ports/output/plan-repository.port';
import { ListPlansUseCase } from './application/use-cases/list-plans/list-plans.use-case';
import { PlanOrmEntity } from '../../infrastructure/persistence/mikro-orm/entities/plan-orm.entity';
import { MikroOrmPlanRepository } from '../../infrastructure/persistence/mikro-orm/repositories/plan.repository';
import { PlanMapper } from '../../infrastructure/persistence/mikro-orm/mappers/plan.mapper';

@Module({
  imports: [MikroOrmModule.forFeature([PlanOrmEntity])],
  providers: [
    PlanMapper,
    { provide: PLAN_REPOSITORY, useClass: MikroOrmPlanRepository },
    ListPlansUseCase,
  ],
  exports: [PLAN_REPOSITORY, ListPlansUseCase],
})
export class PlanModule {}
