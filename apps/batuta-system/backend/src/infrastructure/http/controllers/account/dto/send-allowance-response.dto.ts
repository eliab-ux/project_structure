import { DispatchAllowanceDto } from '../../../../../contexts/account/application/use-cases/ensure-account-can-dispatch/ensure-account-can-dispatch.use-case';

export class SendAllowanceResponseDto {
  dailySendCeiling!: number;
  alreadySentToday!: number;
  remainingToday!: number;

  static from(allowance: DispatchAllowanceDto): SendAllowanceResponseDto {
    const dto = new SendAllowanceResponseDto();
    dto.dailySendCeiling = allowance.dailySendCeiling;
    dto.alreadySentToday = allowance.alreadySentToday;
    dto.remainingToday = allowance.remainingToday;
    return dto;
  }
}
