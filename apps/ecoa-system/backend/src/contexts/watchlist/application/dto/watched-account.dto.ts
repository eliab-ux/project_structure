import { WatchedAccount } from '../../domain/entities/watched-account.entity';

/** Application-boundary view of a watched account. */
export class WatchedAccountDto {
  id!: string;
  handle!: string;
  igUserId!: string | null;
  resolved!: boolean;
  active!: boolean;
  addedAt!: Date;

  static fromDomain(account: WatchedAccount): WatchedAccountDto {
    const dto = new WatchedAccountDto();
    dto.id = account.id.value;
    dto.handle = account.handle.value;
    dto.igUserId = account.igUserId;
    dto.resolved = account.igUserId != null;
    dto.active = account.active;
    dto.addedAt = account.addedAt;
    return dto;
  }
}
