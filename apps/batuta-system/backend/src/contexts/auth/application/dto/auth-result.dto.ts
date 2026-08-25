import { AccountDto } from '../../../account/application/dto/account.dto';
import { UserDto } from '../../../user/application/dto/user.dto';

/** What a successful tenant login returns. Tokens plus just enough context to render the shell. */
export class AuthResultDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  user!: UserDto;
  /**
   * Included even when the account is SUSPENDED: login stays allowed precisely so the user can
   * read `status` and `suspensionReason` and know why nothing sends (§5, FASE 1 item 6).
   */
  account!: AccountDto;
}

export class PlatformAuthResultDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  admin!: { id: string; name: string; email: string };
}

export class RefreshResultDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
}
