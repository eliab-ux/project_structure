import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRoleRequestDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_]{2,30}$/, {
    message: 'Código deve ter 2–30 caracteres: letras, números ou _.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Transform(trimmed)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(trimmed)
  description?: string | null;

  /**
   * Each entry is checked against the code-side catalogue by `PermissionSet` — a permission no
   * guard ever checks cannot be granted. The size cap is a payload guard, not a business rule: the
   * catalogue is nowhere near 200 entries, so anything larger is abuse or a bug.
   */
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  permissions!: string[];
}

export class UpdateRoleRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Transform(trimmed)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(trimmed)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  permissions?: string[];
}

/**
 * A frase do §5.1 — o único campo, e validado como todo campo que vem de fora.
 *
 * `MaxLength(1000)`: a frase é uma descrição de papel ("a Ana pode vender, mas não pode dar
 * desconto"), não um documento. O teto existe porque o texto vai para um provedor externo que cobra
 * por token — sem limite, um corpo de 1 MB vira custo e latência de graça para quem enviar.
 * `MinLength(3)` evita gastar uma chamada externa com "ok".
 */
export class ReadPhraseRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  @Transform(trimmed)
  phrase!: string;
}
