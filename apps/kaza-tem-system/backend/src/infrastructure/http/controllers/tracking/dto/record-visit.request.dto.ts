import { IsOptional, IsString } from 'class-validator';

export class RecordVisitRequestDto {
  @IsString()
  link!: string;

  @IsOptional()
  @IsString()
  visitorId?: string;

  @IsOptional()
  @IsString()
  pageUrl?: string;
}
