import { FinancialAccount } from '../../domain/entities/financial-account.entity';
import { FinancialCategory } from '../../domain/entities/financial-category.entity';
import { FinancialTitle } from '../../domain/entities/financial-title.entity';
import { TitleSettlement } from '../../domain/entities/title-settlement.entity';
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

export class TitleSettlementDto {
  id!: string;
  financialAccountId!: string;
  method!: string;
  principal!: number;
  interest!: number;
  fine!: number;
  discount!: number;
  cashAmount!: number;
  settledAt!: Date;

  static fromDomain(settlement: TitleSettlement): TitleSettlementDto {
    const dto = new TitleSettlementDto();
    dto.id = settlement.id;
    dto.financialAccountId = settlement.financialAccountId;
    dto.method = settlement.method;
    dto.principal = settlement.principal;
    dto.interest = settlement.interest;
    dto.fine = settlement.fine;
    dto.discount = settlement.discount;
    dto.cashAmount = settlement.cashAmount;
    dto.settledAt = settlement.settledAt;
    return dto;
  }
}

export class FinancialTitleDto {
  id!: string;
  companyId!: string;
  direction!: string;
  contactId!: string | null;
  categoryId!: string | null;
  description!: string;
  amount!: number;
  openAmount!: number;
  settledPrincipal!: number;
  status!: string;
  origin!: string;
  issueDate!: Date;
  dueDate!: Date;
  settlements!: TitleSettlementDto[];
  createdAt!: Date;

  static fromDomain(title: FinancialTitle): FinancialTitleDto {
    const dto = new FinancialTitleDto();
    dto.id = title.id;
    dto.companyId = title.companyId;
    dto.direction = title.direction;
    dto.contactId = title.contactId;
    dto.categoryId = title.categoryId;
    dto.description = title.description;
    dto.amount = title.amount;
    dto.openAmount = title.openAmount;
    dto.settledPrincipal = title.settledPrincipal;
    dto.status = title.status;
    dto.origin = title.origin;
    dto.issueDate = title.issueDate;
    dto.dueDate = title.dueDate;
    dto.settlements = title.settlements.map(TitleSettlementDto.fromDomain);
    dto.createdAt = title.createdAt;
    return dto;
  }
}
