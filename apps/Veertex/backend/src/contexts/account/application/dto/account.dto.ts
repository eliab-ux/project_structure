import { Account } from '../../domain/entities/account.entity';
import { CodeNumberingMode } from '../../domain/value-objects/account-preferences.vo';

/** As preferências da conta expostas na fronteira da aplicação (§1 do 01A). */
export class AccountPreferencesDto {
  allowDuplicateDocument!: boolean;
  contactCodeMode!: CodeNumberingMode;
  productSkuMode!: CodeNumberingMode;
  contactCarteirizacao!: boolean;

  static fromDomain(account: Account): AccountPreferencesDto {
    const dto = new AccountPreferencesDto();
    dto.allowDuplicateDocument = account.preferences.allowDuplicateDocument;
    dto.contactCodeMode = account.preferences.contactCodeMode;
    dto.productSkuMode = account.preferences.productSkuMode;
    dto.contactCarteirizacao = account.preferences.contactCarteirizacao;
    return dto;
  }
}

/**
 * Application-boundary view of an account.
 *
 * `suspensionReason` is intentionally absent: it is an internal note written by the operator
 * ("inadimplência desde 03/2026"), not something to hand back through the API.
 */
export class AccountDto {
  id!: string;
  name!: string;
  document!: string;
  documentFormatted!: string;
  planId!: string;
  status!: string;
  timezone!: string;
  cancellationRequestedAt!: Date | null;
  preferences!: AccountPreferencesDto;
  createdAt!: Date;

  static fromDomain(account: Account): AccountDto {
    const dto = new AccountDto();
    dto.id = account.id.value;
    dto.name = account.name;
    dto.document = account.document.value;
    dto.documentFormatted = account.document.formatted;
    dto.planId = account.planId;
    dto.status = account.status;
    dto.timezone = account.timezone;
    dto.cancellationRequestedAt = account.cancellationRequestedAt;
    dto.preferences = AccountPreferencesDto.fromDomain(account);
    dto.createdAt = account.createdAt;
    return dto;
  }
}
