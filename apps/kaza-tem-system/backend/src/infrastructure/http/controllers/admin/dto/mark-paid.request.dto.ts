import { IsString } from 'class-validator';

export class AdminMarkPaidRequestDto {
  @IsString()
  adminId!: string;
}
