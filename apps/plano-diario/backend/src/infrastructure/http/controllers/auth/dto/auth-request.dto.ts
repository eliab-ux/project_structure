import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toLowerCase().trim() : value;

/**
 * Aceita a máscara que o usuário digita — `(11) 91234-5678`, `11912345678`, `+55 11 91234-5678`.
 * Aqui a validação é de FORMA (só caracteres de telefone, comprimento plausível); a regra de
 * verdade (DDD válido, nono dígito, E.164) é do Value Object `PhoneNumber`, no domínio.
 */
const PHONE_SHAPE = /^[\d\s()+-]{10,20}$/;

export class RegisterRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  @Transform(normalizeEmail)
  email!: string;

  // 72 é o limite real do bcrypt: acima disso os bytes extras são silenciosamente ignorados,
  // então recusar aqui evita a falsa sensação de senha mais forte.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @Matches(PHONE_SHAPE, { message: 'Informe o WhatsApp com DDD, ex.: (11) 91234-5678' })
  phone!: string;
}

export class UpdatePhoneRequestDto {
  @IsString()
  @Matches(PHONE_SHAPE, { message: 'Informe o WhatsApp com DDD, ex.: (11) 91234-5678' })
  phone!: string;
}

export class ForgotPasswordRequestDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(normalizeEmail)
  email!: string;
}

export class ResetPasswordRequestDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(normalizeEmail)
  email!: string;

  // Exatamente 6 dígitos: qualquer outra coisa é recusada antes de chegar ao banco.
  @IsString()
  @Matches(/^\d{6}$/, { message: 'O código tem 6 dígitos' })
  code!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

export class LoginRequestDto {
  @IsEmail()
  @MaxLength(255)
  @Transform(normalizeEmail)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}

export class RefreshRequestDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1024)
  refreshToken!: string;
}
