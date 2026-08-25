import { IsISO8601, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListProductsMarketplaceQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsISO8601()
  updated_since?: string;
}
