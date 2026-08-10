import { Plan } from '../../domain/entities/plan.entity';

/** Application-boundary view of a plan. Mapped field by field — never a spread of the entity. */
export class PlanDto {
  id!: string;
  code!: string;
  name!: string;
  maxCompanies!: number | null;
  maxUsers!: number | null;
  modules!: string[];

  static fromDomain(plan: Plan): PlanDto {
    const dto = new PlanDto();
    dto.id = plan.id;
    dto.code = plan.code;
    dto.name = plan.name;
    dto.maxCompanies = plan.limits.maxCompanies;
    dto.maxUsers = plan.limits.maxUsers;
    dto.modules = [...plan.limits.modules];
    return dto;
  }
}
