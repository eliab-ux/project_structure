import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_POLICY } from '../../../../../contexts/auth/domain/password-policy';

/**
 * Every field carries validators — a field without them is a bug (CLAUDE.md).
 *
 * Note what these DTOs never have: an `accountId`. The tenant always comes from the JWT, so
 * there is no request shape in the system through which a client could name another tenant.
 * `forbidNonWhitelisted` in the global ValidationPipe rejects it outright if someone sends one.
 */
export class LoginRequestDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  // Only a length bound here: the strength policy applies when SETTING a password, not when
  // checking one. Rejecting a short password at login would leak the policy of an old account.
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_POLICY.maxLength)
  password!: string;
}

export class RefreshTokenRequestDto {
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  refreshToken!: string;
}

export class RequestPasswordResetRequestDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;
}

export class ResetPasswordRequestDto {
  /**
   * The e-mail identifies WHO is resetting — six digits alone are not an identifier, and looking a
   * code up without a user would mean scanning every live code in the database.
   */
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  /**
   * Exactly six digits — the shape is fixed, so anything else is rejected before a bcrypt compare
   * runs. That also keeps this endpoint from being usable as a CPU-burning oracle.
   */
  @IsString()
  @Matches(/^\d{6}$/, { message: 'O código tem 6 dígitos.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  code!: string;

  @IsString()
  @MinLength(PASSWORD_POLICY.minLength, {
    message: `Senha deve ter no mínimo ${PASSWORD_POLICY.minLength} caracteres.`,
  })
  @MaxLength(PASSWORD_POLICY.maxLength)
  newPassword!: string;
}
