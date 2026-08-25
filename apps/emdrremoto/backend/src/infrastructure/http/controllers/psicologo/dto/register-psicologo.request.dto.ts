import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterPsicologoRequestDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;

  @IsString()
  @MinLength(2, { message: 'Nome muito curto.' })
  @MaxLength(150)
  @Matches(/^[a-zA-ZÀ-ÿ\s'.-]+$/, { message: 'Nome deve conter apenas letras.' })
  nome!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(30)
  @Matches(/^[0-9()+\-\s]+$/, { message: 'Telefone inválido.' })
  telefone!: string;

  @IsString()
  @MinLength(6, { message: 'Senha deve ter no mínimo 6 caracteres.' })
  @MaxLength(128)
  senha!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  confsenha!: string;
}
