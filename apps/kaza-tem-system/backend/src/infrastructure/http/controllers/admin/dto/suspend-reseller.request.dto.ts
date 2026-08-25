import { IsString, Length } from 'class-validator';

export class SuspendResellerRequestDto {
  @IsString()
  @Length(5, 255)
  reason!: string;
}
