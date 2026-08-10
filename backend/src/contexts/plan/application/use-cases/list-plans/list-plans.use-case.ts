import { Inject, Injectable } from '@nestjs/common';
import { UseCase } from '@gitspread/shared-kernel';
import { PLAN_REPOSITORY, PlanRepositoryPort } from '../../ports/output/plan-repository.port';
import { PlanDto } from '../../dto/plan.dto';

/** Empty query object: the catalogue is the same for everyone, so there is nothing to filter by. */
export class ListPlansQuery {}

@Injectable()
export class ListPlansUseCase implements UseCase<ListPlansQuery, PlanDto[]> {
  constructor(@Inject(PLAN_REPOSITORY) private readonly plans: PlanRepositoryPort) {}

  async execute(): Promise<PlanDto[]> {
    const plans = await this.plans.listActive();
    return plans.map((plan) => PlanDto.fromDomain(plan));
  }
}
