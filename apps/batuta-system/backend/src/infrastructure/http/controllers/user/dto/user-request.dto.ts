import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_POLICY } from '../../../../../contexts/auth/domain/password-policy';
import { UserRole } from '../../../../../contexts/user/domain/value-objects/user-role.vo';

export class CreateUserRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Matches(/^[a-zA-ZÀ-ÿ0-9\s.'-]+$/, {
    message: 'Nome contém caracteres não permitidos.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  /**
   * WhatsApp — REQUIRED, never `@IsOptional()` (CLAUDE.md regra 9). Recovery is a code sent to this
   * number, so a user created without one cannot recover the account.
   *
   * Deliberately permissive here: this layer only rejects what could not be a phone at all, and the
   * `PhoneE164` value object does the canonical normalisation. Two different notions of "valid
   * phone" in two layers would eventually disagree.
   */
  @IsString()
  @Matches(/^\+?[\d\s().-]{10,20}$/, {
    message: 'WhatsApp inválido. Use DDD + número, ex.: (11) 99999-9999.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone!: string;

  @IsString()
  @MinLength(PASSWORD_POLICY.minLength, {
    message: `Senha deve ter no mínimo ${PASSWORD_POLICY.minLength} caracteres.`,
  })
  @MaxLength(PASSWORD_POLICY.maxLength)
  password!: string;

  @IsEnum(UserRole, { message: 'Papel inválido.' })
  role!: UserRole;

  // No accountId field — the tenant comes from the JWT (and forbidNonWhitelisted rejects one).
}

export class ChangeUserRoleRequestDto {
  @IsEnum(UserRole, { message: 'Papel inválido.' })
  role!: UserRole;
}

export class ChangeUserPhoneRequestDto {
  @IsString()
  @Matches(/^\+?[\d\s().-]{10,20}$/, {
    message: 'WhatsApp inválido. Use DDD + número, ex.: (11) 99999-9999.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone!: string;
}
