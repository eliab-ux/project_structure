import { Injectable } from '@nestjs/common';
import { BankAccount } from '../../../../contexts/finance/domain/entities/bank-account.entity';
import {
  CategoryDirection,
  FinancialCategory,
} from '../../../../contexts/finance/domain/entities/financial-category.entity';
import {
  CashEntry,
  CashEntryType,
} from '../../../../contexts/finance/domain/entities/cash-entry.entity';
import {
  BankAccountId,
  CashEntryId,
  FinancialCategoryId,
} from '../../../../contexts/finance/domain/value-objects/finance-ids.vo';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { UserId } from '../../../../contexts/user/domain/value-objects/user-id.vo';
import { ReservationId } from '../../../../contexts/schedule/domain/value-objects/reservation-id.vo';
import { PaymentMethod } from '../../../../contexts/schedule/domain/entities/reservation.entity';
import { Money } from '../../../../shared/domain/value-objects/money.vo';
import { BankAccountOrmEntity } from '../entities/bank-account-orm.entity';
import { FinancialCategoryOrmEntity } from '../entities/financial-category-orm.entity';
import { CashEntryOrmEntity } from '../entities/cash-entry-orm.entity';

@Injectable()
export class BankAccountMapper {
  toDomain(orm: BankAccountOrmEntity): BankAccount {
    return BankAccount.restore({
      id: BankAccountId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      name: orm.name,
      bank: orm.bank,
      openingBalanceCents: orm.openingBalanceCents,
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(
    domain: BankAccount,
    target: BankAccountOrmEntity = new BankAccountOrmEntity(),
  ): BankAccountOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.name = domain.name;
    target.bank = domain.bank;
    target.openingBalanceCents = domain.openingBalanceCents;
    target.isActive = domain.isActive;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}

@Injectable()
export class FinancialCategoryMapper {
  toDomain(orm: FinancialCategoryOrmEntity): FinancialCategory {
    return FinancialCategory.restore({
      id: FinancialCategoryId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      name: orm.name,
      direction: orm.direction as CategoryDirection,
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(
    domain: FinancialCategory,
    target: FinancialCategoryOrmEntity = new FinancialCategoryOrmEntity(),
  ): FinancialCategoryOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.name = domain.name;
    target.direction = domain.direction;
    target.isActive = domain.isActive;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}

@Injectable()
export class CashEntryMapper {
  toDomain(orm: CashEntryOrmEntity): CashEntry {
    return CashEntry.restore({
      id: CashEntryId.from(orm.id),
      accountId: AccountId.from(orm.accountId),
      type: orm.type as CashEntryType,
      // Data de calendário em UTC — ver a nota em `customer-orm.entity.ts`.
      occurredOn: new Date(`${orm.occurredOn}T00:00:00.000Z`),
      amount: Money.fromCents(orm.amountCents),
      categoryId: orm.categoryId ? FinancialCategoryId.from(orm.categoryId) : null,
      bankAccountId: BankAccountId.from(orm.bankAccountId),
      counterpartAccountId: orm.counterpartAccountId
        ? BankAccountId.from(orm.counterpartAccountId)
        : null,
      description: orm.description,
      payee: orm.payee,
      paymentMethod: orm.paymentMethod as PaymentMethod | null,
      reservationId: orm.reservationId ? ReservationId.from(orm.reservationId) : null,
      createdBy: UserId.from(orm.createdBy),
      // Os três campos do cancelamento andam juntos — o CHECK no banco garante.
      cancellation:
        orm.cancelledAt && orm.cancelledReason && orm.cancelledBy
          ? {
              at: orm.cancelledAt,
              reason: orm.cancelledReason,
              by: UserId.from(orm.cancelledBy),
            }
          : null,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  toOrm(
    domain: CashEntry,
    target: CashEntryOrmEntity = new CashEntryOrmEntity(),
  ): CashEntryOrmEntity {
    target.id = domain.id.value;
    target.accountId = domain.accountId.value;
    target.type = domain.type;
    target.occurredOn = domain.occurredOn.toISOString().slice(0, 10);
    target.amountCents = domain.amount.cents;
    target.categoryId = domain.categoryId?.value ?? null;
    target.bankAccountId = domain.bankAccountId.value;
    target.counterpartAccountId = domain.counterpartAccountId?.value ?? null;
    target.description = domain.description;
    target.payee = domain.payee;
    target.paymentMethod = domain.paymentMethod;
    target.reservationId = domain.reservationId?.value ?? null;
    target.createdBy = domain.createdBy.value;
    target.cancelledAt = domain.cancellation?.at ?? null;
    target.cancelledReason = domain.cancellation?.reason ?? null;
    target.cancelledBy = domain.cancellation?.by.value ?? null;
    target.createdAt = domain.createdAt;
    target.updatedAt = domain.updatedAt;
    return target;
  }
}
