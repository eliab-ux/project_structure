import { IsString } from 'class-validator';

export class AdminRejectWithdrawalRequestDto {
  @IsString()
  adminId!: string;

  @IsString()
  reason!: string;
}
