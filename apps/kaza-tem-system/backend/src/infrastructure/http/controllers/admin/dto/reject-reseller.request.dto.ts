import { IsString, MinLength } from 'class-validator';

export class RejectResellerRequestDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}
