import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRouteRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trimmed)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimmed)
  code?: string | null;
}

export class UpdateRouteRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Transform(trimmed)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Transform(trimmed)
  code?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ListRoutesQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  includeInactive?: boolean;
}

/** Regra Comercial: cada dimensão é uma lista de ids/códigos (checkboxes). Vazia = sem restrição. */
export class SetCommercialRuleRequestDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  allowedCompanyIds!: string[];

  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  allowedPaymentConditionIds!: string[];

  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  allowedPriceListIds!: string[];

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  allowedOperationNatures!: string[];
}
