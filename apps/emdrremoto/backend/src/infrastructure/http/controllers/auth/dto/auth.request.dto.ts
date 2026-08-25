import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginRequestDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres.' })
  @MaxLength(128)
  senha!: string;
}

export class RefreshRequestDto {
  @IsString()
  @MaxLength(1024)
  refreshToken!: string;
}

export class RequestResetRequestDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;
}

export class ResetPasswordRequestDto {
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  code!: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres.' })
  @MaxLength(128)
  senha!: string;
}

export class PacienteAccessRequestDto {
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  hash!: string;
}
