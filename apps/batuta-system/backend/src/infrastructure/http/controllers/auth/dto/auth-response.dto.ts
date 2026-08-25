import { AccountDto } from '../../../../../contexts/account/application/dto/account.dto';
import { UserDto } from '../../../../../contexts/user/application/dto/user.dto';
import {
  AuthResultDto,
  PlatformAuthResultDto,
  RefreshResultDto,
} from '../../../../../contexts/auth/application/dto/auth-result.dto';
import { MeDto } from '../../../../../contexts/auth/application/use-cases/me/get-me.use-case';

/** HTTP view of a user. Explicit field-by-field mapping — no spread of an entity. */
export class UserResponseDto {
  id!: string;
  name!: string;
  email!: string;
  /** Where a password-recovery code would be sent. `null` only for pre-column rows. */
  phone!: string | null;
  role!: string;
  status!: string;
  lastLoginAt!: string | null;
  createdAt!: string;

  static from(user: UserDto): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.email = user.email;
    dto.phone = user.phone;
    dto.role = user.role;
    dto.status = user.status;
    dto.lastLoginAt = user.lastLoginAt?.toISOString() ?? null;
    dto.createdAt = user.createdAt.toISOString();
    // passwordHash is not reachable from here — UserDto never carried it.
    return dto;
  }
}

export class AccountResponseDto {
  id!: string;
  name!: string;
  documentMasked!: string;
  plan!: string;
  status!: string;
  dailySendCeiling!: number;
  timezone!: string;
  hasDedicatedEvolutionServer!: boolean;
  /** Present so a suspended tenant can see WHY nothing is sending. */
  suspendedAt!: string | null;
  suspensionReason!: string | null;
  createdAt!: string;

  static from(account: AccountDto): AccountResponseDto {
    const dto = new AccountResponseDto();
    dto.id = account.id;
    dto.name = account.name;
    dto.documentMasked = account.documentMasked;
    dto.plan = account.plan;
    dto.status = account.status;
    dto.dailySendCeiling = account.dailySendCeiling;
    dto.timezone = account.timezone;
    dto.hasDedicatedEvolutionServer = account.hasDedicatedEvolutionServer;
    dto.suspendedAt = account.suspendedAt?.toISOString() ?? null;
    dto.suspensionReason = account.suspensionReason;
    dto.createdAt = account.createdAt.toISOString();
    // evolutionApiKey and the raw document are never mapped.
    return dto;
  }
}

export class LoginResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  user!: UserResponseDto;
  account!: AccountResponseDto;

  static from(result: AuthResultDto): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.accessToken = result.accessToken;
    dto.refreshToken = result.refreshToken;
    dto.expiresIn = result.expiresIn;
    dto.user = UserResponseDto.from(result.user);
    dto.account = AccountResponseDto.from(result.account);
    return dto;
  }
}

export class RefreshResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;

  static from(result: RefreshResultDto): RefreshResponseDto {
    const dto = new RefreshResponseDto();
    dto.accessToken = result.accessToken;
    dto.refreshToken = result.refreshToken;
    dto.expiresIn = result.expiresIn;
    return dto;
  }
}

export class MeResponseDto {
  user!: UserResponseDto;
  account!: AccountResponseDto;

  static from(me: MeDto): MeResponseDto {
    const dto = new MeResponseDto();
    dto.user = UserResponseDto.from(me.user);
    dto.account = AccountResponseDto.from(me.account);
    return dto;
  }
}

export class PlatformLoginResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  admin!: { id: string; name: string; email: string };

  static from(result: PlatformAuthResultDto): PlatformLoginResponseDto {
    const dto = new PlatformLoginResponseDto();
    dto.accessToken = result.accessToken;
    dto.refreshToken = result.refreshToken;
    dto.expiresIn = result.expiresIn;
    dto.admin = result.admin;
    return dto;
  }
}
