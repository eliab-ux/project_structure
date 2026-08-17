import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { USER_ROLES } from '../../../../../contexts/user/domain/value-objects/user-role.vo';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateUserRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trim)
  name!: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(normalizeEmail)
  email!: string;

  /**
   * Obrigatório sem exceção (regra 9 do CLAUDE.md): é por ele que chega o código de recuperação
   * de senha. Aceita o formato que o Administrativo digita — `(62) 9 9870-8893` — e o
   * `PhoneE164` normaliza.
   */
  @IsString()
  @MinLength(10, { message: 'Informe o WhatsApp com DDD.' })
  @MaxLength(20)
  @Transform(trim)
  phone!: string;

  @IsIn(USER_ROLES, { message: `Papel deve ser um de: ${USER_ROLES.join(', ')}.` })
  role!: string;

  @IsString()
  @MinLength(8, { message: 'A senha inicial deve ter pelo menos 8 caracteres.' })
  @MaxLength(72)
  initialPassword!: string;
}

export class UpdateUserRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trim)
  name!: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(normalizeEmail)
  email!: string;

  @IsString()
  @MinLength(10, { message: 'Informe o WhatsApp com DDD.' })
  @MaxLength(20)
  @Transform(trim)
  phone!: string;

  @IsIn(USER_ROLES, { message: `Papel deve ser um de: ${USER_ROLES.join(', ')}.` })
  role!: string;

  // A senha NÃO está aqui: ninguém redefine a senha de outra pessoa. Quem esqueceu usa a
  // recuperação por código no WhatsApp.
}

export class SetUserActiveRequestDto {
  @IsBoolean()
  isActive!: boolean;
}
