import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class FabricRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trim)
  name!: string;

  /**
   * Em centímetros, com até duas casas. É o campo que a §4.5 chama de coração da estimativa: a
   * altura máxima limita as camadas, e as camadas determinam o tempo.
   *
   * `maxDecimalPlaces: 2` casa com a coluna `numeric(5,2)` — aceitar 2,499 gravaria 2,50 e
   * devolveria um valor diferente do digitado.
   */
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Use até duas casas decimais (ex.: 2.5).' })
  @Min(0.01, { message: 'Altura máxima de enfesto deve ser maior que zero.' })
  @Max(999.99)
  maxLayerHeightCm!: number;

  /**
   * Espessura de UMA camada, em centímetros. **Opcional de propósito.**
   *
   * Sem ela o sistema não avisa nada sobre altura — e é isso que se quer enquanto o cadastro não
   * foi medido. Tornar obrigatório faria o operador digitar um número qualquer para salvar, e esse
   * número viraria aviso falso em todo corte do tecido.
   *
   * Três casas casam com a coluna `numeric(6,3)`: tecido fino se mede em milímetros (0,015 cm).
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Use até três casas decimais (ex.: 0.035).' })
  @Min(0.001, { message: 'Espessura da camada deve ser maior que zero.' })
  @Max(10)
  layerThicknessCm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(trim)
  notes?: string | null;
}

export class ProductTypeRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trim)
  name!: string;
}
