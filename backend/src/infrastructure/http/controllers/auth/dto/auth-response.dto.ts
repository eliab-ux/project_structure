import { AccountDto } from '../../../../../contexts/account/application/dto/account.dto';
import { RoleDto } from '../../../../../contexts/role/application/dto/role.dto';
import { UserDto } from '../../../../../contexts/user/application/dto/user.dto';
import {
  AuthResultDto,
  RefreshResultDto,
} from '../../../../../contexts/auth/application/dto/auth-result.dto';
import { MeDto } from '../../../../../contexts/auth/application/use-cases/me/get-me.use-case';

/** HTTP view of a user. Explicit field-by-field mapping — never a spread of an entity or a DTO. */
export class UserResponseDto {
  id!: string;
  name!: string;
  email!: string;
  /** Where a password-recovery code would be sent. Never a hash, never a token. */
  phone!: string;
  roleId!: string;
  status!: string;
  lastLoginAt!: Date | null;
  createdAt!: Date;

  static from(user: UserDto): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.name = user.name;
    dto.email = user.email;
    dto.phone = user.phone;
    dto.roleId = user.roleId;
    dto.status = user.status;
    dto.lastLoginAt = user.lastLoginAt;
    dto.createdAt = user.createdAt;
    return dto;
  }
}

export class AccountResponseDto {
  id!: string;
  name!: string;
  documentFormatted!: string;
  status!: string;
  timezone!: string;
  cancellationRequestedAt!: Date | null;

  static from(account: AccountDto): AccountResponseDto {
    const dto = new AccountResponseDto();
    dto.id = account.id;
    dto.name = account.name;
    dto.documentFormatted = account.documentFormatted;
    dto.status = account.status;
    dto.timezone = account.timezone;
    dto.cancellationRequestedAt = account.cancellationRequestedAt;
    return dto;
  }
}

export class RoleResponseDto {
  id!: string;
  code!: string;
  name!: string;
  description!: string | null;
  permissions!: string[];
  isSystem!: boolean;
  isAdministrative!: boolean;

  static from(role: RoleDto): RoleResponseDto {
    const dto = new RoleResponseDto();
    dto.id = role.id;
    dto.code = role.code;
    dto.name = role.name;
    dto.description = role.description;
    dto.permissions = role.permissions;
    dto.isSystem = role.isSystem;
    dto.isAdministrative = role.isAdministrative;
    return dto;
  }
}

export class LoginResponseDto {
  accessToken!: string;
  refreshToken!: string;
  expiresIn!: number;
  user!: UserResponseDto;
  accountId!: string;
  permissions!: string[];

  static from(result: AuthResultDto): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.accessToken = result.accessToken;
    dto.refreshToken = result.refreshToken;
    dto.expiresIn = result.expiresIn;
    dto.user = UserResponseDto.from(result.user);
    dto.accountId = result.accountId;
    dto.permissions = result.permissions;
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
  role!: RoleResponseDto | null;

  static from(me: MeDto): MeResponseDto {
    const dto = new MeResponseDto();
    dto.user = UserResponseDto.from(me.user);
    dto.account = AccountResponseDto.from(me.account);
    dto.role = me.role ? RoleResponseDto.from(me.role) : null;
    return dto;
  }
}
