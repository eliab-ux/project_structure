import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Normaliza antes de validar — o usuário digita com espaço e maiúscula sem pensar nisso. */
const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * Limites de senha repetidos aqui e no `PlainPassword` de propósito: são as duas camadas
 * independentes do CLAUDE.md. Esta rejeita o malformado antes do use case; a do domínio garante a
 * invariante mesmo para quem chame o use case por outro caminho (script, teste, futura CLI).
 */
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

export class LoginRequestDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(normalizeEmail)
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Informe a senha.' })
  @MaxLength(PASSWORD_MAX)
  password!: string;
}

export class RefreshTokenRequestDto {
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  refreshToken!: string;
}

export class ChangePasswordRequestDto {
  @IsString()
  @MinLength(1, { message: 'Informe a senha atual.' })
  @MaxLength(PASSWORD_MAX)
  currentPassword!: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `A nova senha deve ter pelo menos ${PASSWORD_MIN} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX)
  newPassword!: string;
}

export class RequestPasswordResetRequestDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(normalizeEmail)
  email!: string;
}

export class ChangeOwnPhoneRequestDto {
  /**
   * Sem campo de "usuário alvo": o alvo é sempre quem está autenticado. Aceitar um id aqui seria
   * reabrir exatamente a porta que a §6.12 fecha.
   */
  @IsString()
  @MinLength(10, { message: 'Informe o WhatsApp com DDD.' })
  @MaxLength(20)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone!: string;
}

export class ResetPasswordRequestDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(normalizeEmail)
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'O código tem 6 dígitos.' })
  code!: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `A nova senha deve ter pelo menos ${PASSWORD_MIN} caracteres.`,
  })
  @MaxLength(PASSWORD_MAX)
  newPassword!: string;
}
