import { FinancialAccount } from '../../domain/entities/financial-account.entity';
import { FinancialCategory } from '../../domain/entities/financial-category.entity';
import {
  FINANCIAL_ACCOUNT_TYPE_LABEL,
  FinancialAccountType,
} from '../../domain/financial-account-type';

export class FinancialAccountDto {
  id!: string;
  name!: string;
  type!: string;
  typeLabel!: string;
  institution!: string | null;
  initialBalance!: number;
  automatic!: boolean;
  active!: boolean;

  static fromDomain(account: FinancialAccount): FinancialAccountDto {
    const dto = new FinancialAccountDto();
    dto.id = account.id;
    dto.name = account.name;
    dto.type = account.type;
    dto.typeLabel =
      FINANCIAL_ACCOUNT_TYPE_LABEL[account.type as FinancialAccountType] ?? account.type;
    dto.institution = account.institution;
    dto.initialBalance = account.initialBalance;
    dto.automatic = account.automatic;
    dto.active = account.active;
    return dto;
  }
}

export class FinancialCategoryDto {
  id!: string;
  name!: string;
  kind!: string;
  parentId!: string | null;
  dreLine!: string | null;
  defaultOperation!: string | null;
  active!: boolean;

  static fromDomain(category: FinancialCategory): FinancialCategoryDto {
    const dto = new FinancialCategoryDto();
    dto.id = category.id;
    dto.name = category.name;
    dto.kind = category.kind;
    dto.parentId = category.parentId;
    dto.dreLine = category.dreLine;
    dto.defaultOperation = category.defaultOperation;
    dto.active = category.active;
    return dto;
  }
}
