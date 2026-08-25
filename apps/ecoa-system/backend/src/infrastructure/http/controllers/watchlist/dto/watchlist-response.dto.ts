import { WatchedAccountDto } from '../../../../../contexts/watchlist/application/dto/watched-account.dto';

export class WatchedAccountResponseDto {
  id!: string;
  handle!: string;
  igUserId!: string | null;
  resolved!: boolean;
  active!: boolean;
  addedAt!: Date;

  static fromDto(account: WatchedAccountDto): WatchedAccountResponseDto {
    const dto = new WatchedAccountResponseDto();
    dto.id = account.id;
    dto.handle = account.handle;
    dto.igUserId = account.igUserId;
    dto.resolved = account.resolved;
    dto.active = account.active;
    dto.addedAt = account.addedAt;
    return dto;
  }
}
