import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Teto de sanidade contra digitar reais no campo de centavos — o mesmo do `Money`. */
const MAX_PRICE_CENTS = 1_000_000;

export class CreateMachineRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trim)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  model?: string | null;

  /**
   * Em CENTAVOS, inteiros. O frontend converte antes de enviar. Aceitar reais em ponto flutuante
   * aqui traria o erro de arredondamento para dentro do sistema pela porta da frente.
   */
  @IsInt({ message: 'Preço deve ser informado em centavos inteiros.' })
  @Min(1, { message: 'Preço da hora deve ser maior que zero.' })
  @Max(MAX_PRICE_CENTS)
  hourPriceCents!: number;
}

export class UpdateMachineRequestDto extends CreateMachineRequestDto {
  @IsBoolean()
  isActive!: boolean;
}
