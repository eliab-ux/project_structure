import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { TRIP_STATUSES } from '../../../../../contexts/route/domain/entities/trip.entity';

export class CreateTripRequestDto {
  @IsUUID()
  companyId!: string;

  @IsUUID()
  routeId!: string;

  @IsUUID()
  salesRepId!: string;

  @IsOptional()
  @IsUUID()
  helperUserId?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  initialCash?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(9_999_999)
  initialKm?: number;
}

export class ArriveTripRequestDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999)
  returnCash?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(9_999_999)
  finalKm?: number;
}

export class ListTripsQueryDto {
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsUUID()
  salesRepId?: string;

  @IsOptional()
  @IsIn(TRIP_STATUSES as unknown as string[])
  status?: string;
}

export class CargoLineRequestDto {
  @IsUUID()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9_999_999)
  quantity!: number;
}

export class LoadTripCargoRequestDto {
  /** Depósito (warehouse) de onde a carga sai. */
  @IsUUID()
  fromLocationId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos um item.' })
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CargoLineRequestDto)
  lines!: CargoLineRequestDto[];
}
