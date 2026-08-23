import { Route } from '../../domain/entities/route.entity';
import { CommercialRule } from '../../domain/entities/commercial-rule.entity';

export class RouteDto {
  id!: string;
  name!: string;
  code!: string | null;
  active!: boolean;
  createdAt!: Date;

  static fromDomain(route: Route): RouteDto {
    const dto = new RouteDto();
    dto.id = route.id;
    dto.name = route.name;
    dto.code = route.code;
    dto.active = route.active;
    dto.createdAt = route.createdAt;
    return dto;
  }
}

export class CommercialRuleDto {
  userId!: string;
  allowedCompanyIds!: string[];
  allowedPaymentConditionIds!: string[];
  allowedPriceListIds!: string[];
  allowedOperationNatures!: string[];

  static fromDomain(rule: CommercialRule): CommercialRuleDto {
    const dto = new CommercialRuleDto();
    dto.userId = rule.userId;
    dto.allowedCompanyIds = [...rule.allowedCompanyIds];
    dto.allowedPaymentConditionIds = [...rule.allowedPaymentConditionIds];
    dto.allowedPriceListIds = [...rule.allowedPriceListIds];
    dto.allowedOperationNatures = [...rule.allowedOperationNatures];
    return dto;
  }
}
