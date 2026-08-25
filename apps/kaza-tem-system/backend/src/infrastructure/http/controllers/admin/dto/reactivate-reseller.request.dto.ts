import { IsOptional, IsString } from 'class-validator';

export class ReactivateResellerRequestDto {
  @IsOptional()
  @IsString()
  note?: string;
}
