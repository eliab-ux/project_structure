import { IsString } from 'class-validator';

export class CancelOrderRequestDto {
  @IsString()
  reason!: string;
}
