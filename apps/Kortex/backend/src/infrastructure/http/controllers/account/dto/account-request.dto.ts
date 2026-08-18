import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ReportOwnerRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trim)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trim)
  role?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(trim)
  phone?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'E-mail do responsável inválido.' })
  @MaxLength(255)
  @Transform(trim)
  email?: string | null;
}

export class UpdateAccountSettingsRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trim)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trim)
  city!: string;

  /**
   * Fuso IANA da operação — `Região/Cidade`.
   *
   * O `Matches` só confere o FORMATO; se o fuso existe de verdade quem diz é o `Intl` no domínio.
   * Uma lista de fusos aqui envelheceria a cada mudança de legislação e recusaria nomes válidos.
   */
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z]+\/[A-Za-z_+-]+(\/[A-Za-z_+-]+)?$/, {
    message: 'Fuso horário no formato IANA (ex.: America/Sao_Paulo).',
  })
  @Transform(trim)
  timezone!: string;

  /**
   * O bloco inteiro é opcional (conta nova ainda não sabe quem assina o relatório), mas se vier,
   * `ValidateNested` faz cada campo passar pelas próprias regras — sem ele o objeto entraria sem
   * validação nenhuma, que é a falha clássica de DTO aninhado.
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReportOwnerRequestDto)
  reportOwner?: ReportOwnerRequestDto | null;
}

export class AddBusinessHourRequestDto {
  @IsInt()
  @Min(0, { message: 'Dia da semana vai de 0 (domingo) a 6 (sábado).' })
  @Max(6, { message: 'Dia da semana vai de 0 (domingo) a 6 (sábado).' })
  weekday!: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Use o formato HH:MM (ex.: 07:00).' })
  startsAt!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Use o formato HH:MM (ex.: 11:30).' })
  endsAt!: string;
}
