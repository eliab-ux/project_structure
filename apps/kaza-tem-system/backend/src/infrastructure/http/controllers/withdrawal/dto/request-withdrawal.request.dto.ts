import { ValidateNested, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class BankDataDto {
  @IsString()
  bankName!: string;

  @IsString()
  bankAgency!: string;

  @IsString()
  bankAccount!: string;

  @IsOptional()
  @IsString()
  bankAccountType?: string;

  @IsOptional()
  @IsString()
  pixKey?: string;
}

export class RequestWithdrawalRequestDto {
  @ValidateNested()
  @Type(() => BankDataDto)
  bankData!: BankDataDto;

  get bankName() {
    return this.bankData.bankName;
  }

  get bankAgency() {
    return this.bankData.bankAgency;
  }

  get bankAccount() {
    return this.bankData.bankAccount;
  }

  get bankAccountType() {
    return this.bankData.bankAccountType;
  }

  get pixKey() {
    return this.bankData.pixKey;
  }
}
