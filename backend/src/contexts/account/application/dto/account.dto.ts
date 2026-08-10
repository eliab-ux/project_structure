import { Account } from '../../domain/entities/account.entity';

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
    dto.createdAt = account.createdAt;
    return dto;
  }
}
