import { Injectable } from '@nestjs/common';
import { Document } from '../../../../shared/domain/value-objects/document.vo';
import { Account } from '../../../../contexts/account/domain/entities/account.entity';
import { AccountId } from '../../../../contexts/account/domain/value-objects/account-id.vo';
import { CommissionDueRule } from '../../../../contexts/account/domain/value-objects/account-preferences.vo';
import {
  AccountPreferences,
  CodeNumberingMode,
} from '../../../../contexts/account/domain/value-objects/account-preferences.vo';
import { AccountOrmEntity } from '../entities/account-orm.entity';

@Injectable()
export class AccountMapper {
  toDomain(orm: AccountOrmEntity): Account {
    return Account.reconstitute({
      id: AccountId.from(orm.id),
      name: orm.name,
      document: Document.create(orm.document),
      planId: orm.planId,
      status: orm.status,
      timezone: orm.timezone,
      suspendedAt: orm.suspendedAt,
      suspensionReason: orm.suspensionReason,
      cancellationRequestedAt: orm.cancellationRequestedAt,
      cancelledAt: orm.cancelledAt,
      preferences: AccountPreferences.create({
        allowDuplicateDocument: orm.allowDuplicateDocument,
        contactCodeMode: orm.contactCodeMode as CodeNumberingMode,
        productSkuMode: orm.productSkuMode as CodeNumberingMode,
        contactCarteirizacao: orm.contactCarteirizacao,
        stockAllowNegative: orm.stockAllowNegative,
        commissionDueRule: orm.commissionDueRule as CommissionDueRule,
        commissionDueDay: orm.commissionDueDay,
      }),
      createdAt: orm.createdAt,
    });
  }

  toOrmData(account: Account): Record<string, unknown> {
    return {
      id: account.id.value,
      name: account.name,
      document: account.document.value,
      planId: account.planId,
      status: account.status,
      timezone: account.timezone,
      suspendedAt: account.suspendedAt,
      suspensionReason: account.suspensionReason,
      cancellationRequestedAt: account.cancellationRequestedAt,
      cancelledAt: account.cancelledAt,
      allowDuplicateDocument: account.preferences.allowDuplicateDocument,
      contactCodeMode: account.preferences.contactCodeMode,
      productSkuMode: account.preferences.productSkuMode,
      contactCarteirizacao: account.preferences.contactCarteirizacao,
      stockAllowNegative: account.preferences.stockAllowNegative,
      commissionDueRule: account.preferences.commissionDueRule,
      commissionDueDay: account.preferences.commissionDueDay,
      createdAt: account.createdAt,
      updatedAt: new Date(),
    };
  }
}
