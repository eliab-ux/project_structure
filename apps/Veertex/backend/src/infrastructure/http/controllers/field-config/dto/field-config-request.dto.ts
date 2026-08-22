import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Uma sobreposição de campo. `field` é validado contra o catálogo NO DOMÍNIO (não dá para listar
 * os campos válidos aqui sem duplicar o catálogo — o `FieldConfig` recusa o desconhecido na escrita). */
export class FieldOverrideRequestDto {
  @IsString()
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  field!: string;

  @IsBoolean()
  visible!: boolean;

  @IsBoolean()
  required!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  label?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  order?: number | null;
}

export class SetFieldConfigRequestDto {
  @IsArray()
  // Teto generoso: o maior catálogo (Produto) tem ~34 campos. 200 cobre folgado e barra abuso.
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => FieldOverrideRequestDto)
  overrides!: FieldOverrideRequestDto[];
}
