import { IsOptional, IsPositive } from 'class-validator';

export class CieloRefundRequestDto {
  @IsOptional()
  @IsPositive()
  amount?: number;
}
