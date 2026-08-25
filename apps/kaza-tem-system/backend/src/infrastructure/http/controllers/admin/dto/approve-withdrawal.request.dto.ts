import { IsString } from 'class-validator';

export class AdminApproveWithdrawalRequestDto {
  @IsString()
  adminId!: string;
}
