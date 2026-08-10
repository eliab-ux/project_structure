import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PASSWORD_POLICY } from '../../../../../contexts/auth/domain/password-policy';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const lowercased = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * Name, e-mail AND phone are all required — none of them is `@IsOptional()` (CLAUDE.md regra 9).
 * This is the first of the three layers enforcing it; the second is the `PhoneE164` value object
 * and the third is the `NOT NULL` column.
 */
export class CreateUserRequestDto {
  @IsString()
  @MinLength(2, { message: 'Nome deve ter ao menos 2 caracteres.' })
  @MaxLength(200)
  @Transform(trimmed)
  name!: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(lowercased)
  email!: string;

  /**
   * WhatsApp. Accepts what an operator actually types — the `PhoneE164` VO normalises
   * `(62) 99999-9999`, `62999999999` and `+5562999999999` to one canonical form; this only rejects
   * what could not possibly be a number.
   */
  @IsString()
  @Matches(/^[\d\s()+-]{10,20}$/, { message: 'WhatsApp inválido. Informe DDD + número.' })
  @Transform(trimmed)
  phone!: string;

  @IsString()
  @MinLength(PASSWORD_POLICY.minLength, {
    message: `A senha deve ter no mínimo ${PASSWORD_POLICY.minLength} caracteres.`,
  })
  @MaxLength(PASSWORD_POLICY.maxLength)
  password!: string;

  @IsUUID('4', { message: 'Papel inválido.' })
  roleId!: string;
}

/** Partial update. `password` is absent: changing it has its own flow and its own proof of identity. */
export class UpdateUserRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trimmed)
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(lowercased)
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d\s()+-]{10,20}$/, { message: 'WhatsApp inválido. Informe DDD + número.' })
  @Transform(trimmed)
  phone?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Papel inválido.' })
  roleId?: string;
}

export class SetUserStatusRequestDto {
  @IsBoolean()
  active!: boolean;
}
