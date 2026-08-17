import { UuidId } from '../../../../shared/domain/value-objects/uuid-id.vo';

export class BankAccountId extends UuidId {
  static from(value: string): BankAccountId {
    return new BankAccountId(UuidId.parse(value, 'Identificador da conta bancária'));
  }

  static create(): BankAccountId {
    return new BankAccountId(UuidId.generate());
  }
}

export class FinancialCategoryId extends UuidId {
  static from(value: string): FinancialCategoryId {
    return new FinancialCategoryId(UuidId.parse(value, 'Identificador da categoria'));
  }

  static create(): FinancialCategoryId {
    return new FinancialCategoryId(UuidId.generate());
  }
}

export class CashEntryId extends UuidId {
  static from(value: string): CashEntryId {
    return new CashEntryId(UuidId.parse(value, 'Identificador do lançamento'));
  }

  static create(): CashEntryId {
    return new CashEntryId(UuidId.generate());
  }
}
