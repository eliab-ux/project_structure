import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class DayNumberParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(400)
  dayNumber!: number;
}

/**
 * Permite conferir o alinhamento com outro `plan_start_date`/`day_offset` sem alterar nada —
 * é uma simulação de leitura, não uma configuração.
 */
export class ListCatalogQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'planStartDate deve estar no formato yyyy-MM-dd' })
  planStartDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-30)
  @Max(30)
  dayOffset?: number;
}

export class TodayQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date deve estar no formato yyyy-MM-dd' })
  date?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'planStartDate deve estar no formato yyyy-MM-dd' })
  planStartDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-30)
  @Max(30)
  dayOffset?: number;
}
