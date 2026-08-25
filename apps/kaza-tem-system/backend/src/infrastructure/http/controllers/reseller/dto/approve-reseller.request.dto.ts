import { IsString } from 'class-validator';

export class ApproveResellerRequestDto {
  @IsString()
  approvedBy!: string;
}
